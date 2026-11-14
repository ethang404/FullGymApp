const { Op, literal } = require("sequelize");
const sequelize = require("../models/db");

//This importing says, take "food" and call it "FoodModel" in this file
//Same as this: const WorkoutsModel = require("../models/modelInits").workouts;
const {
	food: FoodModel,
	foodNutrient: FoodNutrientModel,
	foodServingSize: FoodServingSizeModel,
	diaryEntries: DiaryEntryModel,
	recipe: RecipeModel,
	recipeIngredient: RecipeIngredientModel,
} = require("../models/modelInits");

const { NotFoundError, DataError } = require("../error");
const { isValidDate, parseDateRange } = require("../utils/dates");
const { assertOneOf } = require("../utils/validate");
const { findOwned } = require("../utils/ownership");
const { MEAL_TYPES } = require("../constants");
const { NUTRIENT_MAP, MACRO_IDS, toGrams, calcNutrients, mapNutrients } = require("./nutrients");
const { serializeFood, serializeFoodSearchResult, serializeRecipeSummary, serializeRecipeDetail, serializeDiaryEntry } = require("../serializers/nutrition");
const { importRecipeFromUrl } = require("./recipeImport");

//nutrient math (NUTRIENT_MAP, calcNutrients...) lives in ./nutrients.js, response shapes in serializers/nutrition.js

//everything serializeDiaryEntry needs to compute macros for a food or a recipe entry
//the food nutrients/serving sizes include is written out twice on purpose - sharing one object between both spots breaks the query
const DIARY_INCLUDE = [
	{
		model: FoodModel,
		required: false,
		include: [{ model: FoodNutrientModel }, { model: FoodServingSizeModel }],
	},
	{
		model: RecipeModel,
		required: false,
		include: [
			{
				model: RecipeIngredientModel,
				include: [{ model: FoodModel, include: [{ model: FoodNutrientModel }, { model: FoodServingSizeModel }] }],
			},
		],
	},
];

// ---------------------------------------------
// HELPERS
// ---------------------------------------------

//takes in array of food items and calculates nutrients for each
//used to build out recipe ingredients.
async function buildIngredientRows(ingredients, recipe_id, t) {
	const rows = [];

	//do this across all food id's to avoid N+1 queries
	const foodIds = [...new Set(ingredients.map((item) => item.food_id))];

	const foods = await FoodModel.findAll({
		where: {
			id: { [Op.in]: foodIds },
			is_deleted: false,
		},
		include: [{ model: FoodNutrientModel }, { model: FoodServingSizeModel }],
		transaction: t,
	});

	const foodMap = new Map(foods.map((f) => [f.id, f]));

	for (const item of ingredients) {
		const { food_id, quantity, unit } = item;

		if (!food_id) throw new DataError("Each ingredient requires a food_id");
		if (quantity == null || isNaN(quantity) || quantity <= 0) throw new DataError("Each ingredient requires a valid quantity");
		if (!unit) throw new DataError("Each ingredient requires a unit");

		const food = foodMap.get(food_id);
		if (!food) throw new DataError(`Food with id ${food_id} not found`);

		const raw_nutrients = calcNutrients(quantity, unit, food.foodServingSizes, food.foodNutrients, { name: food.name, brand: food.brand });
		const mapped = mapNutrients(raw_nutrients); //fetches everything, but we only care about cals/protein/carbs/fats

		rows.push({
			recipe_id,
			food_id,
			quantity,
			unit,
			calories: mapped.calories ?? null,
			protein: mapped.protein ?? null,
			carbs: mapped.carbs ?? null,
			fat: mapped.fat ?? null,
		});
	}

	return rows;
}

// ---------------------------------------------
// FOODS
// ---------------------------------------------

/**
 * GET /foods?query=...
 * Expected: query (string)
 */
async function SearchFoods(query) {
	if (!query || query.trim().length === 0) throw new DataError("Search query is required");

	const sanitised = query.trim();

	// Only return the 4 main macros (MACRO_IDS) in search results for performance. Might include more later
	const foods = await FoodModel.findAll({
		where: {
			is_deleted: false,
			[Op.or]: [
				literal(`to_tsvector('english', name) @@ plainto_tsquery('english', ${sequelize.escape(sanitised)})`),
				literal(`name % ${sequelize.escape(sanitised)}::text`),
				{ name: { [Op.iLike]: `%${sanitised}%` } },
			],
		},
		include: [
			{
				model: FoodNutrientModel,
				where: { nutrient_id: { [Op.in]: MACRO_IDS } },
				required: false,
			},
			{
				// include serving sizes so frontend knows what units are available
				model: FoodServingSizeModel,
				required: false,
			},
		],
		order: [literal(`ts_rank(to_tsvector('english', name), plainto_tsquery('english', ${sequelize.escape(sanitised)})) DESC`)],
		limit: 30,
	});

	//Convert to better serving display not 100g basis
	return foods.map(serializeFoodSearchResult);
}

/**
 * POST /foods
 * Expected: { name, brand?, barcode?, nutrients: [...], serving_sizes: [...] }
 */
async function CreateFood(data, user_id) {
	if (!data.name?.trim()) throw new DataError("Food name is required");
	if (!Array.isArray(data.nutrients) || data.nutrients.length === 0) throw new DataError("At least one nutrient is required");
	if (!Array.isArray(data.serving_sizes) || data.serving_sizes.length === 0) throw new DataError("At least one serving size is required");

	for (const n of data.nutrients) {
		//if (!n.nutrient_id) throw new DataError("Each nutrient must have a nutrient_id");
		if (!n.nutrient_name?.trim()) throw new DataError("Each nutrient must have a nutrient_name");
		if (!n.unit?.trim()) throw new DataError("Each nutrient must have a unit");
		if (n.nutrient_amount == null || isNaN(n.nutrient_amount)) throw new DataError("Each nutrient must have a valid nutrient_amount");
		if (!NUTRIENT_MAP[n.nutrient_name]) throw new DataError("Invalid Nutrient id/name");
	}

	for (const s of data.serving_sizes) {
		if (!s.label?.trim()) throw new DataError("Each serving size must have a label");
		if (s.weight_g == null || isNaN(s.weight_g) || s.weight_g <= 0) throw new DataError("Each serving size must have a valid weight_g");
		if (s.default_quantity != null && (isNaN(s.default_quantity) || s.default_quantity <= 0)) throw new DataError("default_quantity must be a positive number");
	}

	//for each nutrient, convert to a 100g basis for database

	const serving_grams = data.serving_sizes[0].weight_g; //amount of g in a serving of the food..get first serving for conversion

	const normalized_nutrients = data.nutrients.map((nut) => {
		const per100g = (parseFloat(nut.nutrient_amount) / serving_grams) * 100;

		return {
			nutrient_id: NUTRIENT_MAP[nut.nutrient_name].nutrient_id,
			nutrient_name: NUTRIENT_MAP[nut.nutrient_name].nutrient_name,
			unit: nut.unit,
			amount_per_100g: per100g,
		};
	});

	const result = await sequelize.transaction(async (t) => {
		const newFood = await FoodModel.create(
			{
				name: data.name.trim(),
				brand: data.brand?.trim() || null,
				barcode: data.barcode?.trim() || null,
				source: "user_submitted",
				submitted_by: user_id,
			},
			{ transaction: t },
		);

		await FoodNutrientModel.bulkCreate(
			normalized_nutrients.map((n) => ({ ...n, food_id: newFood.id })),
			{ transaction: t },
		);

		await FoodServingSizeModel.bulkCreate(
			data.serving_sizes.map((s) => ({
				food_id: newFood.id,
				label: s.label.trim(),
				weight_g: s.weight_g,
				default_quantity: s.default_quantity ?? null,
			})),
			{ transaction: t },
		);

		//need to do reload here to make sure we display the correct data
		return newFood.reload({
			include: [{ model: FoodNutrientModel }, { model: FoodServingSizeModel }],
			transaction: t,
		});
	});

	return result;
}

async function getFood(food_id) {
	if (!food_id) throw new DataError("Food ID required");
	const food = await FoodModel.findOne({
		where: { id: food_id, is_deleted: false },
		include: [
			{ model: FoodNutrientModel, required: false },
			{ model: FoodServingSizeModel, required: false },
		],
	});

	if (!food) throw new NotFoundError("Food not found");
	return serializeFood(food);
}

async function addFoodServing(food_id, label, weight_g, default_quantity) {
	const food = await FoodModel.findByPk(food_id);
	if (!food) throw new NotFoundError("Food not found");

	const newServing = await FoodServingSizeModel.create({
		food_id,
		label,
		weight_g,
		default_quantity: default_quantity ?? null,
	});
	return newServing;
}

// ---------------------------------------------
// DIARY ENTRIES
// ---------------------------------------------

/**
 * POST /diary
 * Expected: { food_id OR recipe_id, meal_type, logged_at, quantity, unit }
 */
async function addDiaryEntry(data, user_id) {
	const { food_id, recipe_id, meal_type, logged_at, quantity, unit } = data;

	if (!food_id && !recipe_id) throw new DataError("Either food_id or recipe_id is required");
	if (food_id && recipe_id) throw new DataError("Cannot log both a food and a recipe at the same time");

	assertOneOf(meal_type, MEAL_TYPES, "meal_type");
	if (!logged_at || !isValidDate(logged_at)) throw new DataError("logged_at must be YYYY-MM-DD");
	if (quantity == null || isNaN(quantity) || quantity <= 0) throw new DataError("quantity must be a positive number");
	if (!unit) throw new DataError("unit is required");

	if (food_id) {
		//Fetch food and validate unit via toGrams
		//Create DiaryEntry
		const food = await FoodModel.findByPk(food_id, {
			include: [{ model: FoodServingSizeModel, required: true }],
		});

		if (!food || food.is_deleted) throw new NotFoundError("No food found");

		toGrams(quantity, unit, food.foodServingSizes, { name: food.name, brand: food.brand }); //throws if invalid

		const diary_entry = await DiaryEntryModel.create({
			user_id,
			food_id,
			meal_type,
			logged_at,
			quantity,
			unit,
		});

		return diary_entry;
	}

	if (recipe_id) {
		if (unit !== "serving") throw new DataError('Recipe entries must use unit: "serving"');

		await findOwned(RecipeModel, recipe_id, user_id, "Recipe", { where: { is_deleted: false } });

		const entry = await DiaryEntryModel.create({ user_id, recipe_id, meal_type, logged_at, quantity, unit });
		return entry;
	}
}

// Loads diary entries matching `where` with everything needed to compute their macros.
async function fetchAndSerializeDiaryEntries(where) {
	const diary_entries = await DiaryEntryModel.findAll({
		where,
		include: DIARY_INCLUDE,
		order: [
			["logged_at", "ASC"],
			["meal_type", "ASC"],
		],
	});

	return diary_entries.map(serializeDiaryEntry).filter(Boolean); //rows with neither a food nor a recipe (left over from old hard deletes) are skipped, not sent as null
}

/**
 * GET /diary?start_date=...&end_date=...
 * Expected: start_date (YYYY-MM-DD), end_date?, meal_type?
 */
async function getDiaryEntries(user_id, start_date, end_date, meal_type) {
	//need paranthesis here around variables since already defined
	({ start_date, end_date } = parseDateRange(start_date, end_date));

	const where = {
		user_id,
		logged_at: { [Op.between]: [start_date, end_date] },
	};

	if (meal_type) {
		assertOneOf(meal_type, MEAL_TYPES, "meal_type");
		where.meal_type = meal_type;
	}

	return fetchAndSerializeDiaryEntries(where);
}

/**
 * PUT /diary/:id
 * Expected: data { quantity?, unit?, meal_type?, logged_at? }
 */
async function editDiaryEntry(entry_id, data, user_id) {
	if (isNaN(entry_id)) throw new DataError("Invalid entry id");

	const entry = await findOwned(DiaryEntryModel, entry_id, user_id, "Diary entry");

	const quantity = data.quantity ?? entry.quantity;
	const unit = data.unit ?? entry.unit;
	const meal_type = data.meal_type ?? entry.meal_type;
	const logged_at = data.logged_at ?? entry.logged_at;

	if (data.meal_type) assertOneOf(meal_type, MEAL_TYPES, "meal_type");
	if (data.logged_at && !isValidDate(data.logged_at)) throw new DataError("logged_at must be YYYY-MM-DD");
	if (data.quantity != null && (isNaN(data.quantity) || data.quantity <= 0)) throw new DataError("quantity must be a positive number");

	if (entry.food_id) {
		if (data.unit || data.quantity) {
			const food = await FoodModel.findByPk(entry.food_id, {
				include: [{ model: FoodServingSizeModel }],
			});
			toGrams(quantity, unit, food.foodServingSizes, { name: food.name, brand: food.brand });
		}
	}

	if (entry.recipe_id && unit !== "serving") {
		throw new DataError('Recipe entries must use unit: "serving"');
	}

	await entry.update({ quantity, unit, meal_type, logged_at });

	//Refetch with full joins so we return calculated nutrients - same shape as GET /diary
	const [updated] = await fetchAndSerializeDiaryEntries({ id: entry.id });
	return updated;
}

async function deleteDiaryEntry(entry_id, user_id) {
	if (isNaN(entry_id)) throw new DataError("Invalid entry id");
	const entry = await findOwned(DiaryEntryModel, entry_id, user_id, "Diary entry");
	await entry.destroy();
	return { deleted: true, id: entry_id };
}

// ---------------------------------------------
// RECIPES
// ---------------------------------------------

//Do these first. Also maybe get rid of add/remove recipe ingrediant and intead do an edit endpoint like workout

/**
 * POST /recipes
 * Expected: { name, description?, servings?, ingredients: [{ food_id, quantity, unit }] }
 */
async function createRecipe(data, user_id) {
	const { name, description, servings, ingredients } = data;

	if (!name?.trim()) throw new DataError("Recipe name is required");
	if (!Array.isArray(ingredients) || ingredients.length === 0) throw new DataError("At least one ingredient is required");

	const result = await sequelize.transaction(async (t) => {
		const newRecipe = await RecipeModel.create({ user_id, name: name.trim(), description: description ?? null, servings: servings ?? 1 }, { transaction: t });

		const rows = await buildIngredientRows(ingredients, newRecipe.recipe_id, t);

		await RecipeIngredientModel.bulkCreate(rows, { transaction: t });

		return newRecipe.reload({ include: RecipeIngredientModel, transaction: t });
	});

	return result;
}

async function deleteRecipe(recipe_id, user_id) {
	if (isNaN(recipe_id)) throw new DataError("Invalid recipe id");
	//already deleted is a 404 too
	const recipe = await findOwned(RecipeModel, recipe_id, user_id, "Recipe", { where: { is_deleted: false } });

	//soft delete recipe
	await recipe.update({ is_deleted: true });
	return { deleted: true, id: recipe_id };
}

async function editRecipe(recipe_id, user_id, data) {
	if (isNaN(recipe_id)) throw new DataError("Invalid recipe id");

	const recipe = await findOwned(RecipeModel, recipe_id, user_id, "Recipe", {
		where: { is_deleted: false },
		include: RecipeIngredientModel,
	});

	if (!Array.isArray(data.ingredients) || data.ingredients.length === 0) {
		throw new DataError("At least one ingredient is required");
	}

	//Do checks before destructure to handle possible missing errors
	const name = data.name?.trim() ?? recipe.name;
	if (!name) throw new DataError("Recipe name is required");

	const description = data.description !== undefined ? data.description : recipe.description;
	const servings = data.servings != null ? parseFloat(data.servings) : parseFloat(recipe.servings);
	if (isNaN(servings) || servings <= 0) throw new DataError("servings must be a positive number");

	//const { name, description, servings } = data;

	const result = await sequelize.transaction(async (t) => {
		await recipe.update({ name, description, servings }, { transaction: t });

		const incomingIds = new Set(data.ingredients.filter((i) => i.ingredient_id).map((i) => i.ingredient_id));

		//Delete rows not in the incoming list (removed ingrediant)
		const toDelete = recipe.recipeIngredients.filter((ing) => !incomingIds.has(ing.ingredient_id));
		await Promise.all(toDelete.map((ing) => ing.destroy({ transaction: t })));

		//Build recalculated macro rows for all incoming ingredients
		const rows = await buildIngredientRows(data.ingredients, recipe_id, t);

		await Promise.all(
			rows.map((row, index) => {
				const incoming = data.ingredients[index];
				if (incoming.ingredient_id) {
					//Existing ingred: update
					return RecipeIngredientModel.update(row, {
						where: { ingredient_id: incoming.ingredient_id, recipe_id },
						transaction: t,
					});
				} else {
					//New ingred
					return RecipeIngredientModel.create(row, { transaction: t });
				}
			}),
		);

		return recipe.reload({ include: RecipeIngredientModel, transaction: t });
	});

	return result;
}

async function getRecipes(user_id) {
	const recipes = await RecipeModel.findAll({
		include: [
			{
				model: RecipeIngredientModel,
				required: false,
			},
		],
		where: { user_id, is_deleted: false },
	});

	return recipes.map(serializeRecipeSummary);
}

/**
 * GET /recent
 * Most recently logged distinct foods and recipes for this user, newest first.
 * Food items come back in the same shape as /foods search results and recipe
 * items in the same shape as /recipes, so the frontend can reuse the same cards.
 */
async function getRecentLogged(user_id, limit = 20) {
	// Over-fetch recent rows, then de-dupe by food/recipe keeping the newest.
	// Order by the autoincrement id (monotonic with insertion = log order) rather
	// than a timestamp column, so we don't depend on the created_at column name.
	const rows = await DiaryEntryModel.findAll({
		where: { user_id },
		order: [["id", "DESC"]],
		limit: 100,
	});

	const seenFoods = new Set();
	const seenRecipes = new Set();
	const ordered = []; // [{ kind: "food", id }, { kind: "recipe", id }]

	for (const row of rows) {
		if (ordered.length >= limit) break;
		if (row.food_id != null && !seenFoods.has(row.food_id)) {
			seenFoods.add(row.food_id);
			ordered.push({ kind: "food", id: row.food_id });
		} else if (row.recipe_id != null && !seenRecipes.has(row.recipe_id)) {
			seenRecipes.add(row.recipe_id);
			ordered.push({ kind: "recipe", id: row.recipe_id });
		}
	}

	const [foods, recipes] = await Promise.all([
		seenFoods.size
			? FoodModel.findAll({
					where: { id: { [Op.in]: [...seenFoods] }, is_deleted: false },
					include: [
						{ model: FoodNutrientModel, where: { nutrient_id: { [Op.in]: MACRO_IDS } }, required: false },
						{ model: FoodServingSizeModel, required: false },
					],
				})
			: [],
		seenRecipes.size
			? RecipeModel.findAll({
					where: { recipe_id: { [Op.in]: [...seenRecipes] }, user_id, is_deleted: false },
					include: [{ model: RecipeIngredientModel, required: false }],
				})
			: [],
	]);

	// Serialize per-item: this endpoint reads arbitrary historical diary rows, so
	// one malformed food/recipe (e.g. a serving size with a null weight_g) should
	// drop that item, not 500 the whole list.
	const foodMap = new Map();
	for (const f of foods) {
		try {
			foodMap.set(f.id, serializeFoodSearchResult(f));
		} catch (e) {
			console.warn(`getRecentLogged: skipping food ${f.id} - ${e.message}`);
		}
	}

	const recipeMap = new Map();
	for (const r of recipes) {
		try {
			recipeMap.set(r.recipe_id, serializeRecipeSummary(r));
		} catch (e) {
			console.warn(`getRecentLogged: skipping recipe ${r.recipe_id} - ${e.message}`);
		}
	}

	// Rebuild in recency order, dropping anything that no longer exists (deleted food/recipe).
	return ordered
		.map((item) =>
			item.kind === "food"
				? foodMap.has(item.id) && { type: "food", food: foodMap.get(item.id) }
				: recipeMap.has(item.id) && { type: "recipe", recipe: recipeMap.get(item.id) },
		)
		.filter(Boolean);
}

async function getRecipe(recipe_id, user_id) {
	const recipe = await findOwned(RecipeModel, recipe_id, user_id, "Recipe", {
		where: { is_deleted: false },
		include: [
			{
				model: RecipeIngredientModel,
				required: false,
				include: [{ model: FoodModel, include: [{ model: FoodNutrientModel }, { model: FoodServingSizeModel }] }],
			},
		],
	});
	return serializeRecipeDetail(recipe);
}

module.exports = {
	// Foods
	SearchFoods,
	CreateFood,
	getFood,
	addFoodServing,
	// Diary
	addDiaryEntry,
	getDiaryEntries,
	editDiaryEntry,
	deleteDiaryEntry,
	getRecentLogged,
	fetchAndSerializeDiaryEntries, //Posts/service.js uses it to show a shared diary entry
	// Recipes
	createRecipe,
	editRecipe,
	getRecipes,
	getRecipe,
	deleteRecipe,
	importRecipeFromUrl,
};
