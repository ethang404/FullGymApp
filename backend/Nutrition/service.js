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

const { NotFoundError, DataError, ForbiddenError } = require("../error");

//Mapping of nutrients to compare against
const NUTRIENT_MAP = {
	// ── Core macros ──────────────────────────────────────────
	calories: { nutrient_id: 1008, nutrient_name: "Energy", unit: "kcal" },
	protein: { nutrient_id: 1003, nutrient_name: "Protein", unit: "g" },
	fat: { nutrient_id: 1004, nutrient_name: "Total lipid (fat)", unit: "g" },
	carbs: { nutrient_id: 1005, nutrient_name: "Carbohydrate, by difference", unit: "g" },

	// ── Carb breakdown ───────────────────────────────────────
	fiber: { nutrient_id: 1079, nutrient_name: "Fiber, total dietary", unit: "g" },
	sugar: { nutrient_id: 2000, nutrient_name: "Sugars, total including NLEA", unit: "g" },
	added_sugar: { nutrient_id: 1235, nutrient_name: "Sugars, added", unit: "g" },

	// ── Fat breakdown ────────────────────────────────────────
	saturated_fat: { nutrient_id: 1258, nutrient_name: "Fatty acids, total saturated", unit: "g" },
	trans_fat: { nutrient_id: 1257, nutrient_name: "Fatty acids, total trans", unit: "g" },
	polyunsaturated_fat: { nutrient_id: 1293, nutrient_name: "Fatty acids, total polyunsaturated", unit: "g" },
	monounsaturated_fat: { nutrient_id: 1292, nutrient_name: "Fatty acids, total monounsaturated", unit: "g" },

	// ── Minerals ─────────────────────────────────────────────
	sodium: { nutrient_id: 1093, nutrient_name: "Sodium, Na", unit: "mg" },
	cholesterol: { nutrient_id: 1253, nutrient_name: "Cholesterol", unit: "mg" },
	calcium: { nutrient_id: 1087, nutrient_name: "Calcium, Ca", unit: "mg" },
	iron: { nutrient_id: 1089, nutrient_name: "Iron, Fe", unit: "mg" },
	potassium: { nutrient_id: 1092, nutrient_name: "Potassium, K", unit: "mg" },
	magnesium: { nutrient_id: 1090, nutrient_name: "Magnesium, Mg", unit: "mg" },
	phosphorus: { nutrient_id: 1091, nutrient_name: "Phosphorus, P", unit: "mg" },
	zinc: { nutrient_id: 1095, nutrient_name: "Zinc, Zn", unit: "mg" },

	// ── Vitamins ─────────────────────────────────────────────
	vitamin_a: { nutrient_id: 1106, nutrient_name: "Vitamin A, RAE", unit: "µg" },
	vitamin_c: { nutrient_id: 1162, nutrient_name: "Vitamin C, total ascorbic acid", unit: "mg" },
	vitamin_d: { nutrient_id: 1114, nutrient_name: "Vitamin D (D2 + D3)", unit: "µg" },
	vitamin_e: { nutrient_id: 1109, nutrient_name: "Vitamin E (alpha-tocopherol)", unit: "mg" },
	vitamin_k: { nutrient_id: 1185, nutrient_name: "Vitamin K (phylloquinone)", unit: "µg" },
	vitamin_b6: { nutrient_id: 1175, nutrient_name: "Vitamin B-6", unit: "mg" },
	vitamin_b12: { nutrient_id: 1178, nutrient_name: "Vitamin B-12", unit: "µg" },
	folate: { nutrient_id: 1177, nutrient_name: "Folate, total", unit: "µg" },
	thiamin: { nutrient_id: 1165, nutrient_name: "Thiamin", unit: "mg" },
	riboflavin: { nutrient_id: 1166, nutrient_name: "Riboflavin", unit: "mg" },
	niacin: { nutrient_id: 1167, nutrient_name: "Niacin", unit: "mg" },

	// ── Other ────────────────────────────────────────────────
	water: { nutrient_id: 1051, nutrient_name: "Water", unit: "g" },
	alcohol: { nutrient_id: 1018, nutrient_name: "Alcohol, ethyl", unit: "g" },
	caffeine: { nutrient_id: 1057, nutrient_name: "Caffeine", unit: "mg" },
};

//map id:display name for saving to recipe ingred and returning to user later
const ID_TO_DISPLAY = Object.fromEntries(Object.entries(NUTRIENT_MAP).map(([key, val]) => [val.nutrient_id, key]));

/**
 * Validates YYYY-MM-DD date strings
 */
function isValidDate(str) {
	return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str));
}

// ---------------------------------------------
// HELPERS
// ---------------------------------------------

/**
 * Expected: (quantity: number, unit: string, servingSizes: Array)
 * Logic: Should find the unit in servingSizes and return the weight in grams.
 */
const toGrams = (quantity, unit, servingSizes) => {
	// Check if unit is 'g', 'kg', or matches a servingSizes label
	// Throw DataError if unit is invalid for this food
	switch (unit) {
		case "g":
			return quantity;
		case "kg":
			return quantity * 1000;
		default: {
			const serving = servingSizes.find((s) => s.label === unit);
			if (!serving) throw new DataError(`Unit "${unit}" is not available for this food`);
			return quantity * parseFloat(serving.weight_g);
		}
	}
};

//This converts from our database 100g basis to whatever amount the user chose
const calcNutrients = (quantity, unit, servingSizes, nutrients) => {
	const grams = toGrams(quantity, unit, servingSizes);

	let result = [];
	let amount;

	for (let n of nutrients) {
		amount = (parseFloat(n.amount_per_100g) * grams) / 100;
		result.push({
			nutrient_id: n.nutrient_id,
			name: n.nutrient_name,
			unit: n.unit,
			amount: parseFloat(amount.toFixed(4)),
		});
	}

	return result;
};

/**
 * Expected: (ingredients: Array, scale: number)
 * Logic: Should scale the snapshot macros of a recipe by the portion eaten.
 */
const scaleMacros = (ingredients, scale) => {
	//sum up all the stored macro snapshots across every ingredient
	const totalCalories = ingredients.reduce((sum, ing) => sum + parseFloat(ing.calories ?? 0), 0);
	const totalProtein = ingredients.reduce((sum, ing) => sum + parseFloat(ing.protein ?? 0), 0);
	const totalCarbs = ingredients.reduce((sum, ing) => sum + parseFloat(ing.carbs ?? 0), 0);
	const totalFat = ingredients.reduce((sum, ing) => sum + parseFloat(ing.fat ?? 0), 0);

	//multiply by scale to get only the portion the user ate
	//ex: recipe makes 4 servings, user ate 1...scale = 1/4 = 0.25
	return {
		calories: parseFloat((totalCalories * scale).toFixed(4)),
		protein: parseFloat((totalProtein * scale).toFixed(4)),
		carbs: parseFloat((totalCarbs * scale).toFixed(4)),
		fat: parseFloat((totalFat * scale).toFixed(4)),
	};
};

async function buildIngredientRows(ingredients, recipe_id) {
	//Given array of ingrediants and a optional recipe id.

	//Get nutrition data for foods to calculate recipe ingrediants
	const food_ids = ingredients.map((i) => i.food_id);

	const full_food_data = await FoodModel.findAll({
		where: { id: { [Op.in]: food_ids } },
		include: [
			{ model: FoodNutrientModel, required: true },
			{ model: FoodServingSizeModel, required: true },
		],
	});

	const foodMap = Object.fromEntries(full_food_data.map((f) => [f.id, f]));

	return ingredients.map((ing) => {
		const food = foodMap[ing.food_id];
		if (!food) throw new NotFoundError(`Food ${ing.food_id} not found`);

		//convert fetched foods to user given amounts from 100g
		toGrams(ing.quantity, ing.unit, food.foodServingSizes); //used for throwing if serving not found
		const nutrients = calcNutrients(ing.quantity, ing.unit, food.foodServingSizes, food.foodNutrients);

		return {
			recipe_id,
			food_id: food.id,
			quantity: ing.quantity,
			unit: ing.unit,
			calories: nutrients[1008] ?? null,
			protein: nutrients[1003] ?? null,
			carbs: nutrients[1005] ?? null,
			fat: nutrients[1004] ?? null,
		};
	});
}

//given raw nutrient ID's in an array, return macro names with amounts in dictionary
function mapNutrients(rawNutrients) {
	const mapped = {};
	for (const n of rawNutrients) {
		const key = ID_TO_DISPLAY[n.nutrient_id];
		if (key) mapped[key] = parseFloat(n.amount) || 0;
	}
	return mapped;
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

	// Only return the 4 main macros in search results for performance. Might include more later
	const MACRO_IDS = [1008, 1003, 1005, 1004];

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
	return foods.map((food) => {
		const { foodNutrients, foodServingSizes, ...foodJson } = food.toJSON();

		const servingSizes = (foodServingSizes ?? []).map(({ label, weight_g }) => ({ label, weight_g: parseFloat(weight_g) }));
		const nutrients = foodNutrients ?? [];

		const fallback = { label: "g", weight_g: 100 }; //use a fallback of 100g basis stored in db if we have no serving size data.

		const displayServing = servingSizes[0] ?? fallback;
		const usingFallback = servingSizes.length === 0;

		const quantity = usingFallback ? displayServing.weight_g : 1;
		const unit = displayServing.label;

		return {
			...foodJson,
			serving_sizes: servingSizes,
			default_serving: {
				label: usingFallback ? "g" : displayServing.label,
				weight_g: displayServing.weight_g,
				macros: calcNutrients(quantity, unit, servingSizes, nutrients),
			},
			nutrients_per_100g: nutrients.map((n) => ({
				//we use this data to convert on frontend for display purposes
				nutrient_id: n.nutrient_id,
				name: n.nutrient_name,
				unit: n.unit,
				amount_per_100g: parseFloat(n.amount_per_100g),
			})),
		};
	});
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
		if (!n.nutrient_id) throw new DataError("Each nutrient must have a nutrient_id");
		if (!n.nutrient_name?.trim()) throw new DataError("Each nutrient must have a nutrient_name");
		if (!n.unit?.trim()) throw new DataError("Each nutrient must have a unit");
		if (n.nutrient_amount == null || isNaN(n.nutrient_amount)) throw new DataError("Each nutrient must have a valid nutrient_amount");
		if (!NUTRIENT_MAP[n.nutrient_name]) throw new DataError("Invalid Nutrient id/name");
	}

	for (const s of data.serving_sizes) {
		if (!s.label?.trim()) throw new DataError("Each serving size must have a label");
		if (s.weight_g == null || isNaN(s.weight_g) || s.weight_g <= 0) throw new DataError("Each serving size must have a valid weight_g");
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
			data.serving_sizes.map((s) => ({ food_id: newFood.id, label: s.label.trim(), weight_g: s.weight_g })),
			{ transaction: t },
		);

		return newFood;
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

	if (!food) throw new DataError("Food ID doesn't exist");

	const { foodNutrients, foodServingSizes, ...foodJson } = food.toJSON();

	const servingSizes = (foodServingSizes ?? []).map(({ label, weight_g }) => ({
		label,
		weight_g: parseFloat(weight_g),
	}));

	let nutrients = foodNutrients ?? [];

	let nutrients_per_100g = nutrients.map((n) => ({
		//we use this data to convert on frontend for display purposes
		nutrient_id: n.nutrient_id,
		name: n.nutrient_name,
		unit: n.unit,
		amount_per_100g: parseFloat(n.amount_per_100g),
	}));

	let retVal = {
		...foodJson,
		serving_sizes: servingSizes,
		nutrients_per_100g,
	};

	return retVal;
}

async function addFoodServing(food_id, label, weight_g) {
	const food = await FoodModel.findByPk(food_id);
	if (!food) throw new DataError("Food ID doesn't exist");

	const newServing = await FoodServingSizeModel.create({
		food_id,
		label,
		weight_g,
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

	const validMeals = ["breakfast", "lunch", "dinner", "snack"];
	if (!meal_type || !validMeals.includes(meal_type)) throw new DataError("Invalid meal_type");
	if (!logged_at || !isValidDate(logged_at)) throw new DataError("logged_at must be YYYY-MM-DD");
	if (quantity == null || isNaN(quantity) || quantity <= 0) throw new DataError("quantity must be a positive number");
	if (!unit) throw new DataError("unit is required");

	if (food_id) {
		// TODO: Fetch food and validate unit via toGrams
		// TODO: Create DiaryEntry
		const food = await FoodModel.findByPk(food_id, {
			include: [{ model: FoodServingSizeModel, required: true }],
		});

		if (!food || food.is_deleted) throw new NotFoundError("No food found");

		toGrams(quantity, unit, food.foodServingSizes); //throws if invalid

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

		const recipe = await RecipeModel.findByPk(recipe_id);
		if (!recipe) throw new NotFoundError("Recipe not found");
		if (recipe.user_id !== user_id) throw new ForbiddenError("Not your recipe");

		const entry = await DiaryEntryModel.create({ user_id, recipe_id, meal_type, logged_at, quantity, unit });
		return entry;
	}
}

/**
 * GET /diary?start_date=...&end_date=...
 * Expected: start_date (YYYY-MM-DD), end_date?, meal_type?
 */
async function getDiaryEntries(user_id, start_date, end_date, meal_type) {
	if (!start_date) throw new DataError("start_date is required");
	if (!isValidDate(start_date)) throw new DataError("start_date must be YYYY-MM-DD");

	if (!end_date) end_date = start_date;
	if (!isValidDate(end_date)) throw new DataError("end_date must be YYYY-MM-DD");
	if (end_date < start_date) throw new DataError("end_date cannot be before start_date");

	//so we need to get all diary entries + nutrition and all that
	//meaning we need to do big boy join AND also consider it could be a food or recipe

	const where = {
		user_id,
		logged_at: { [Op.between]: [start_date, end_date] },
	};

	if (meal_type) {
		const validMeals = ["breakfast", "lunch", "dinner", "snack"];
		if (!validMeals.includes(meal_type)) throw new DataError("Invalid meal_type");
		where.meal_type = meal_type;
	}

	//obtain list of diary entries between those dates
	const diary_entries = await DiaryEntryModel.findAll({
		where,
		include: [
			{
				model: FoodModel,
				required: false,
				include: [
					{ model: FoodNutrientModel }, // for macro calculation
					{ model: FoodServingSizeModel }, // for unit → grams conversion
				],
			},
			{
				model: RecipeModel,
				required: false,
				include: [{ model: RecipeIngredientModel }], // pre-stored macros for scaling
			},
		],
		order: [
			["logged_at", "ASC"],
			["meal_type", "ASC"],
		],
	});

	return diary_entries.map((e) => {
		if (e.food_id) {
			const raw_nutrients = calcNutrients(e.quantity, e.unit, e.food.foodServingSizes, e.food.foodNutrients);
			return {
				id: e.id,
				type: "food",
				meal_type: e.meal_type,
				logged_at: e.logged_at,
				quantity: parseFloat(e.quantity),
				unit: e.unit,
				food: {
					id: e.food.id,
					name: e.food.name,
					brand: e.food.brand,
				},
				nutrients: mapNutrients(raw_nutrients),
			};
		}
		if (e.recipe_id) {
			const scale = parseFloat(e.quantity) / parseFloat(e.recipe.servings);
			const raw_nutrients = scaleMacros(e.recipe.recipeIngredients, scale);
			return {
				id: e.id,
				type: "recipe",
				meal_type: e.meal_type,
				logged_at: e.logged_at,
				quantity: parseFloat(e.quantity),
				unit: e.unit,
				recipe: {
					id: e.recipe.recipe_id,
					name: e.recipe.name,
					servings: e.recipe.servings,
				},
				nutrients: mapNutrients(raw_nutrients),
			};
		}
	});

	// TODO: Fetch DiaryEntries with joins (Food+Nutrients+ServingSizes or Recipe+Ingredients)
	// TODO: Calculate nutrients for each entry (calcNutrients for food, scaleMacros for recipes)
}

/**
 * PUT /diary/:id
 * Expected: data { quantity?, unit?, meal_type?, logged_at? }
 */
async function editDiaryEntry(entry_id, data, user_id) {
	if (isNaN(entry_id)) throw new DataError("Invalid entry id");

	const entry = await DiaryEntryModel.findByPk(entry_id);
	if (!entry) throw new NotFoundError("Diary entry not found");
	if (entry.user_id !== user_id) throw new ForbiddenError("Not your diary entry");

	const quantity = data.quantity ?? entry.quantity;
	const unit = data.unit ?? entry.unit;
	const meal_type = data.meal_type ?? entry.meal_type;
	const logged_at = data.logged_at ?? entry.logged_at;

	if (data.meal_type) {
		const validMeals = ["breakfast", "lunch", "dinner", "snack"];
		if (!validMeals.includes(meal_type)) throw new DataError("Invalid meal_type");
	}
	if (data.logged_at && !isValidDate(data.logged_at)) throw new DataError("logged_at must be YYYY-MM-DD");
	if (data.quantity != null && (isNaN(data.quantity) || data.quantity <= 0)) throw new DataError("quantity must be a positive number");

	if (entry.food_id) {
		if (data.unit || data.quantity) {
			const food = await FoodModel.findByPk(entry.food_id, {
				include: [{ model: FoodServingSizeModel }],
			});
			toGrams(quantity, unit, food.foodServingSizes);
		}
	}

	if (entry.recipe_id && unit !== "serving") {
		throw new DataError('Recipe entries must use unit: "serving"');
	}

	await entry.update({ quantity, unit, meal_type, logged_at });

	//Refetch with full joins so we can return calculated nutrients
	const updated = await DiaryEntryModel.findByPk(entry_id, {
		include: [
			{
				model: FoodModel,
				required: false,
				include: [{ model: FoodNutrientModel }, { model: FoodServingSizeModel }],
			},
			{
				model: RecipeModel,
				required: false,
				include: [{ model: RecipeIngredientModel }],
			},
		],
	});

	if (updated.food_id) {
		const nutrients = calcNutrients(updated.quantity, updated.unit, updated.food.foodServingSizes, updated.food.foodNutrients);
		return {
			id: updated.id,
			type: "food",
			meal_type: updated.meal_type,
			logged_at: updated.logged_at,
			quantity: parseFloat(updated.quantity),
			unit: updated.unit,
			food: {
				id: updated.food.id,
				name: updated.food.name,
				brand: updated.food.brand,
			},
			nutrients,
		};
	}

	if (updated.recipe_id) {
		const scale = parseFloat(updated.quantity) / parseFloat(updated.recipe.servings);
		const nutrients = scaleMacros(updated.recipe.recipeIngredients, scale);
		return {
			id: updated.id,
			type: "recipe",
			meal_type: updated.meal_type,
			logged_at: updated.logged_at,
			quantity: parseFloat(updated.quantity),
			unit: updated.unit,
			recipe: {
				id: updated.recipe.recipe_id,
				name: updated.recipe.name,
				servings: parseFloat(updated.recipe.servings),
			},
			nutrients,
		};
	}
}

async function deleteDiaryEntry(entry_id, user_id) {
	if (isNaN(entry_id)) throw new DataError("Invalid entry id");
	const entry = await DiaryEntryModel.findByPk(entry_id);
	if (!entry) throw new NotFoundError("Diary entry not found");
	if (entry.user_id !== user_id) throw new ForbiddenError("Not your diary entry");
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
		const recipe = await RecipeModel.create(
			{
				user_id,
				name: name.trim(),
				description: description?.trim() ?? null,
				servings: servings ?? 1,
			},
			{ transaction: t },
		);

		const ingredientRows = await buildIngredientRows(ingredients, recipe.recipe_id);

		const created = await RecipeIngredientModel.bulkCreate(ingredientRows, { transaction: t });
		return { recipe, ingredients: created };
	});

	return result;
}

async function deleteRecipe(recipe_id, user_id) {
	if (isNaN(recipe_id)) throw new DataError("Invalid recipe id");
	const recipe = await RecipeModel.findByPk(recipe_id);
	if (!recipe) throw new NotFoundError("Recipe not found");
	if (recipe.user_id !== user_id) throw new ForbiddenError("Not your recipe");
	await recipe.destroy(); // cascades to recipe_ingredients
	return { deleted: true, id: recipe_id };
}

async function editRecipe(recipe_id, user_id, data) {
	if (isNaN(recipe_id)) throw new DataError("Invalid recipe id");

	const recipe = await RecipeModel.findByPk(recipe_id, {
		include: RecipeIngredientModel,
	});
	if (!recipe) throw new NotFoundError("Recipe not found");
	if (recipe.user_id !== user_id) throw new ForbiddenError("Not your recipe");

	const { name, description, servings } = data;

	const result = await sequelize.transaction(async (t) => {
		await recipe.update({ name, description, servings }, { transaction: t });

		const incomingIds = new Set(data.ingredients.filter((i) => i.ingredient_id).map((i) => i.ingredient_id));

		//Delete rows not in the incoming list (removed ingrediant)
		const toDelete = recipe.recipeIngredients.filter((ing) => !incomingIds.has(ing.ingredient_id));
		await Promise.all(toDelete.map((ing) => ing.destroy({ transaction: t })));

		//Build recalculated macro rows for all incoming ingredients
		const rows = await buildIngredientRows(data.ingredients, recipe_id);

		await Promise.all(
			rows.map((row, index) => {
				const incoming = data.ingredients[index];
				if (incoming.ingredient_id) {
					//Existing ingred: update
					return RecipeIngredientModel.update(row, {
						where: { ingredient_id: incoming.ingredient_id },
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
		where: { user_id },
	});

	return recipes.map((recipe) => {
		const ingredients = recipe.recipeIngredients ?? [];
		const servings = parseFloat(recipe.servings) || 1;

		const totals = {
			total_calories: ingredients.reduce((sum, i) => sum + (parseFloat(i.calories) || 0), 0),
			total_protein: ingredients.reduce((sum, i) => sum + (parseFloat(i.protein) || 0), 0),
			total_carbs: ingredients.reduce((sum, i) => sum + (parseFloat(i.carbs) || 0), 0),
			total_fat: ingredients.reduce((sum, i) => sum + (parseFloat(i.fat) || 0), 0),
		};

		return {
			...recipe.toJSON(),
			calories_per_serving: Math.round(totals.total_calories / servings),
			protein_per_serving: Math.round(totals.total_protein / servings),
			carbs_per_serving: Math.round(totals.total_carbs / servings),
			fat_per_serving: Math.round(totals.total_fat / servings),
		};
	});
}

async function getRecipe(recipe_id, user_id) {
	const recipe = await RecipeModel.findOne({
		where: { recipe_id, user_id },
		include: [
			{
				model: RecipeIngredientModel,
				required: false,
			},
		],
	});

	if (!recipe) throw new NotFoundError("Recipe not found");

	const ingredients = recipe.recipeIngredients ?? [];
	const servings = parseFloat(recipe.servings) || 1;

	const totals = {
		calories: ingredients.reduce((sum, i) => sum + (parseFloat(i.calories) || 0), 0),
		protein: ingredients.reduce((sum, i) => sum + (parseFloat(i.protein) || 0), 0),
		carbs: ingredients.reduce((sum, i) => sum + (parseFloat(i.carbs) || 0), 0),
		fat: ingredients.reduce((sum, i) => sum + (parseFloat(i.fat) || 0), 0),
	};

	return {
		...recipe.toJSON(),
		calories_per_serving: Math.round(totals.calories / servings),
		protein_per_serving: Math.round(totals.protein / servings),
		carbs_per_serving: Math.round(totals.carbs / servings),
		fat_per_serving: Math.round(totals.fat / servings),
		ingredients: ingredients.map((i) => ({
			ingredient_id: i.ingredient_id,
			food_id: i.food_id,
			quantity: parseFloat(i.quantity),
			unit: i.unit,
			calories: parseFloat(i.calories),
			protein: parseFloat(i.protein),
			carbs: parseFloat(i.carbs),
			fat: parseFloat(i.fat),
		})),
	};
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
	// Recipes
	createRecipe,
	editRecipe,
	getRecipes,
	getRecipe,
	deleteRecipe,
};
