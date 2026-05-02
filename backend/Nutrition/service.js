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

// Validates YYYY-MM-DD date strings
function isValidDate(str) {
	return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str));
}

//All this does, is convert any unit we have stored for a food to it's grams basis.
const toGrams = (quantity, unit, servingSizes) => {
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

//Nutrients are stored on a flat 100g basis. So if a food has 2g of protein, and the serving size is 28:
// (2/28) * 100. Grams handles the 28 and quantity part

//Returns { nutrient_name: calculated_amount } for every nutrient row so consisely have all nutrients for a food
// (Instead of array of nurients)
const calcNutrients = (quantity, unit, servingSizes, nutrients) => {
	const grams = toGrams(quantity, unit, servingSizes);
	const multiplier = grams / 100;

	const result = {};
	for (const n of nutrients) {
		result[n.nutrient_name] = parseFloat((parseFloat(n.amount_per_100g) * multiplier).toFixed(4));
	}
	return result;
};

//Recipes/ingrediants are updated less often but are logged very often
//as such we should store a "snapshot" of some macros and re-calculate/save on change

//This takes in recipe ingrediants, and uses the scale to scale down each ingrediant's macros
//scale is: UserAteServings/servings_Recipe_Makes
//So we know how much to log for that diary entry
const scaleMacros = (ingredients, scale) => ({
	calories: parseFloat((ingredients.reduce((s, i) => s + parseFloat(i.calories ?? 0), 0) * scale).toFixed(4)),
	protein: parseFloat((ingredients.reduce((s, i) => s + parseFloat(i.protein ?? 0), 0) * scale).toFixed(4)),
	carbs: parseFloat((ingredients.reduce((s, i) => s + parseFloat(i.carbs ?? 0), 0) * scale).toFixed(4)),
	fat: parseFloat((ingredients.reduce((s, i) => s + parseFloat(i.fat ?? 0), 0) * scale).toFixed(4)),
});

// ---------------------------------------------
// FOODS
// ---------------------------------------------

/**
 * Search for foods by keyword. Returns up to 30 results with macro nutrients.
 * Uses tsvector (full-text), trigram (typos), and ILIKE (prefix/substring).
 */
async function SearchFoods(query) {
	if (!query || query.trim().length === 0) throw new DataError("Search query is required");

	const sanitised = query.trim();

	// Only return the 4 main macros in search results for performance
	const MACRO_IDS = [1008, 1003, 1005, 1004]; // calories, protein, carbs, fat

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

	return foods.map(formatFood);
}

function formatFood(food) {
	const macros = {};
	for (const n of food.foodNutrients ?? []) {
		macros[n.nutrient_name.toLowerCase()] = parseFloat(n.amount_per_100g);
	}

	return {
		id: food.id,
		fdc_id: food.fdc_id,
		name: food.name,
		brand: food.brand,
		barcode: food.barcode,
		source: food.source,
		// available units the user can log this food in
		serving_sizes: (food.foodServingSizes ?? []).map((s) => ({
			label: s.label,
			weight_g: parseFloat(s.weight_g),
		})),
		macros_per_100g: macros,
	};
}

/**
 * Create a user-submitted food with its nutrients and serving sizes.
 *
 * Body:
 * {
 *   name, brand?, barcode?,
 *   nutrients: [{ nutrient_id, nutrient_name, unit, amount_per_100g }],
 *   serving_sizes: [{ label, weight_g }]   // e.g. [{ label: "serving", weight_g: 100 }]
 * }
 */
async function CreateFood(data, user_id) {
	if (!data.name?.trim()) throw new DataError("Food name is required");
	if (!Array.isArray(data.nutrients) || data.nutrients.length === 0) throw new DataError("At least one nutrient is required");
	if (!Array.isArray(data.serving_sizes) || data.serving_sizes.length === 0) throw new DataError("At least one serving size is required");

	for (const n of data.nutrients) {
		if (!n.nutrient_id) throw new DataError("Each nutrient must have a nutrient_id");
		if (!n.nutrient_name?.trim()) throw new DataError("Each nutrient must have a nutrient_name");
		if (!n.unit?.trim()) throw new DataError("Each nutrient must have a unit");
		if (n.amount_per_100g == null || isNaN(n.amount_per_100g)) throw new DataError("Each nutrient must have a valid amount_per_100g");
	}

	for (const s of data.serving_sizes) {
		if (!s.label?.trim()) throw new DataError("Each serving size must have a label");
		if (s.weight_g == null || isNaN(s.weight_g) || s.weight_g <= 0) throw new DataError("Each serving size must have a valid weight_g");
	}

	const result = await sequelize.transaction(async (t) => {
		const newFood = await FoodModel.create(
			{
				name: data.name.trim(),
				brand: data.brand?.trim() ?? null,
				barcode: data.barcode?.trim() ?? null,
				source: "user_submitted",
				submitted_by: user_id,
			},
			{ transaction: t },
		);

		await FoodNutrientModel.bulkCreate(
			data.nutrients.map((n) => ({
				food_id: newFood.id,
				nutrient_id: n.nutrient_id,
				nutrient_name: n.nutrient_name.trim(),
				unit: n.unit.trim(),
				amount_per_100g: n.amount_per_100g,
			})),
			{ transaction: t, ignoreDuplicates: true },
		);

		await FoodServingSizeModel.bulkCreate(
			data.serving_sizes.map((s) => ({
				food_id: newFood.id,
				label: s.label.trim(),
				weight_g: s.weight_g,
			})),
			{ transaction: t, ignoreDuplicates: true },
		);

		return newFood;
	});

	return formatFood({
		...result.toJSON(),
		foodNutrients: [],
		foodServingSizes: data.serving_sizes.map((s) => ({
			label: s.label,
			weight_g: s.weight_g,
		})),
	});
}

// ---------------------------------------------
// DIARY ENTRIES
// ---------------------------------------------

/**
 * Add a diary entry for either a food or a recipe.
 *
 * Food entry body:   { food_id, meal_type, logged_at, quantity, unit }
 * Recipe entry body: { recipe_id, meal_type, logged_at, quantity, unit: "serving" }
 *
 * For food entries, unit must be "g", "kg", or a label in food_serving_sizes for that food.
 * For recipe entries, unit must always be "serving" and quantity is the number of servings
 * relative to recipe.servings (e.g. recipe.servings=4, quantity=2 → ate half the recipe).
 */
async function addDiaryEntry(data, user_id) {
	const { food_id, recipe_id, meal_type, logged_at, quantity, unit } = data;

	// Validate exactly one of food_id / recipe_id is provided
	if (!food_id && !recipe_id) throw new DataError("Either food_id or recipe_id is required");
	if (food_id && recipe_id) throw new DataError("Cannot log both a food and a recipe at the same time");

	// Common field validation
	const validMeals = ["breakfast", "lunch", "dinner", "snack"];
	if (!meal_type) throw new DataError("meal_type is required");
	if (!validMeals.includes(meal_type)) throw new DataError(`meal_type must be one of: ${validMeals.join(", ")}`);
	if (!logged_at) throw new DataError("logged_at is required");
	if (!isValidDate(logged_at)) throw new DataError("logged_at must be YYYY-MM-DD");
	if (quantity == null || isNaN(quantity) || quantity <= 0) throw new DataError("quantity must be a positive number");
	if (!unit) throw new DataError("unit is required");

	if (food_id) {
		// Fetch food + serving sizes to validate the unit
		// No need to fetch food_nutrients at save time - only needed on read
		const food = await FoodModel.findByPk(food_id, {
			include: [{ model: FoodServingSizeModel }],
		});
		if (!food || food.is_deleted) throw new NotFoundError("Food not found");

		// Validate unit is resolvable to grams for this food
		toGrams(quantity, unit, food.foodServingSizes);

		const entry = await DiaryEntryModel.create({ user_id, food_id, meal_type, logged_at, quantity, unit });
		return formatFoodEntry(entry, food, null);
	}

	if (recipe_id) {
		if (unit !== "serving") throw new DataError('Recipe entries must use unit: "serving"');

		const recipe = await RecipeModel.findByPk(recipe_id);
		if (!recipe) throw new NotFoundError("Recipe not found");
		if (recipe.user_id !== user_id) throw new ForbiddenError("Not your recipe");

		const entry = await DiaryEntryModel.create({ user_id, recipe_id, meal_type, logged_at, quantity, unit });
		return formatRecipeEntry(entry, recipe, null);
	}
}

/**
 * Get diary entries for a user between two dates, with full nutrient calculations.
 * This is the "heavy" read query - does all joins and math in one shot.
 */
async function getDiaryEntries(user_id, start_date, end_date, meal_type) {
	if (!start_date) throw new DataError("start_date is required");
	if (!isValidDate(start_date)) throw new DataError("start_date must be YYYY-MM-DD");

	if (!end_date) end_date = start_date;
	if (!isValidDate(end_date)) throw new DataError("end_date must be YYYY-MM-DD");
	if (end_date < start_date) throw new DataError("end_date cannot be before start_date");

	const where = {
		user_id,
		logged_at: { [Op.between]: [start_date, end_date] },
	};

	if (meal_type) {
		const validMeals = ["breakfast", "lunch", "dinner", "snack"];
		if (!validMeals.includes(meal_type)) throw new DataError("Invalid meal_type");
		where.meal_type = meal_type;
	}

	const entries = await DiaryEntryModel.findAll({
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

	return entries.map((e) => {
		if (e.food_id) {
			const nutrients = calcNutrients(e.quantity, e.unit, e.food.foodServingSizes, e.food.foodNutrients);
			return formatFoodEntry(e, e.food, nutrients);
		}
		if (e.recipe_id) {
			const scale = parseFloat(e.quantity) / parseFloat(e.recipe.servings);
			const nutrients = scaleMacros(e.recipe.recipeIngredients, scale);
			return formatRecipeEntry(e, e.recipe, nutrients);
		}
	});
}

/**
 * Edit a diary entry. Re-validates unit on food entries.
 * Returns the updated entry with recalculated nutrients so the frontend
 * doesn't need to refetch the whole day.
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
		// Re-validate unit if it changed
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

	// Refetch with full joins so we can return calculated nutrients
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
		return formatFoodEntry(updated, updated.food, nutrients);
	}

	if (updated.recipe_id) {
		const scale = parseFloat(updated.quantity) / parseFloat(updated.recipe.servings);
		const nutrients = scaleMacros(updated.recipe.recipeIngredients, scale);
		return formatRecipeEntry(updated, updated.recipe, nutrients);
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

function formatFoodEntry(entry, food, nutrients) {
	return {
		id: entry.id,
		type: "food",
		meal_type: entry.meal_type,
		logged_at: entry.logged_at,
		quantity: parseFloat(entry.quantity),
		unit: entry.unit,
		food: {
			id: food.id,
			name: food.name,
			brand: food.brand,
		},
		// null on addDiaryEntry (save path) since we skip the nutrient fetch there
		// fully populated on getDiaryEntries and editDiaryEntry (read path)
		nutrients: nutrients ?? null,
	};
}

function formatRecipeEntry(entry, recipe, nutrients) {
	return {
		id: entry.id,
		type: "recipe",
		meal_type: entry.meal_type,
		logged_at: entry.logged_at,
		quantity: parseFloat(entry.quantity),
		unit: entry.unit,
		recipe: {
			id: recipe.recipe_id,
			name: recipe.name,
			servings: parseFloat(recipe.servings),
		},
		// scaled macros - null on save path, populated on read path
		nutrients: nutrients ?? null,
	};
}

// ---------------------------------------------
// RECIPES
// ---------------------------------------------

/**
 * Create a recipe with ingredients.
 *
 * Body:
 * {
 *   name: string,
 *   description?: string,
 *   servings?: number,      // how many servings this recipe makes (default 1)
 *   ingredients: [
 *     { food_id, quantity, unit }
 *   ]
 * }
 *
 * Macros are pre-calculated and stored on each ingredient row at creation time
 * so recipe totals can be displayed without re-joining food_nutrients.
 */
async function createRecipe(data, user_id) {
	const { name, description, servings, ingredients } = data;

	if (!name?.trim()) throw new DataError("Recipe name is required");
	if (!Array.isArray(ingredients) || ingredients.length === 0) throw new DataError("At least one ingredient is required");

	for (const [i, ing] of ingredients.entries()) {
		if (!ing.food_id) throw new DataError(`Ingredient ${i + 1}: food_id is required`);
		if (ing.quantity == null || isNaN(ing.quantity) || ing.quantity <= 0) throw new DataError(`Ingredient ${i + 1}: quantity must be a positive number`);
		if (!ing.unit?.trim()) throw new DataError(`Ingredient ${i + 1}: unit is required`);
	}

	// Batch-load all foods with nutrients + serving sizes
	const foodIds = [...new Set(ingredients.map((i) => i.food_id))];
	const foods = await FoodModel.findAll({
		where: { id: { [Op.in]: foodIds }, is_deleted: false },
		include: [{ model: FoodNutrientModel }, { model: FoodServingSizeModel }],
	});

	const foodMap = Object.fromEntries(foods.map((f) => [f.id, f]));

	for (const ing of ingredients) {
		if (!foodMap[ing.food_id]) throw new NotFoundError(`Food with id ${ing.food_id} not found`);
	}

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

		const ingredientRows = ingredients.map((ing) => {
			const food = foodMap[ing.food_id];

			// Validate unit is valid for this food before storing
			toGrams(ing.quantity, ing.unit, food.foodServingSizes);

			const nutrients = calcNutrients(ing.quantity, ing.unit, food.foodServingSizes, food.foodNutrients);

			// Helper to find a nutrient by name (case-insensitive fallback)
			const get = (name) => nutrients[name] ?? nutrients[name.toLowerCase()] ?? null;

			return {
				recipe_id: recipe.recipe_id,
				food_id: food.id,
				quantity: ing.quantity,
				unit: ing.unit,
				calories: get("Energy") ?? get("Calories") ?? get("energy") ?? null,
				protein: get("Protein") ?? null,
				carbs: get("Carbohydrate, by difference") ?? get("Carbs") ?? get("carbohydrate") ?? null,
				fat: get("Total lipid (fat)") ?? get("Fat") ?? get("fat") ?? null,
			};
		});

		const created = await RecipeIngredientModel.bulkCreate(ingredientRows, { transaction: t });
		return { recipe, ingredients: created };
	});

	return formatRecipe(result.recipe, result.ingredients, foodMap);
}

async function getRecipes(user_id) {
	const recipes = await RecipeModel.findAll({
		where: { user_id },
		include: [{ model: RecipeIngredientModel }],
		order: [["created_at", "DESC"]],
	});

	return recipes.map((r) => formatRecipe(r, r.recipeIngredients));
}

async function getRecipe(recipe_id, user_id) {
	const recipe = await RecipeModel.findByPk(recipe_id, {
		include: [
			{
				model: RecipeIngredientModel,
				include: [{ model: FoodModel }], // include food so we can return the name
			},
		],
	});

	if (!recipe) throw new NotFoundError("Recipe not found");
	if (recipe.user_id !== user_id) throw new ForbiddenError("Not your recipe");

	return formatRecipe(recipe, recipe.recipeIngredients);
}

async function updateRecipe(recipe_id, data, user_id) {
	const recipe = await RecipeModel.findByPk(recipe_id);
	if (!recipe) throw new NotFoundError("Recipe not found");
	if (recipe.user_id !== user_id) throw new ForbiddenError("Not your recipe");
	if (!data.name?.trim()) throw new DataError("Recipe name cannot be empty");

	await recipe.update({
		name: data.name.trim(),
		description: data.description?.trim() ?? recipe.description,
		servings: data.servings ?? recipe.servings,
	});

	return getRecipe(recipe_id, user_id);
}

async function deleteRecipe(recipe_id, user_id) {
	if (isNaN(recipe_id)) throw new DataError("Invalid recipe id");
	const recipe = await RecipeModel.findByPk(recipe_id);
	if (!recipe) throw new NotFoundError("Recipe not found");
	if (recipe.user_id !== user_id) throw new ForbiddenError("Not your recipe");
	await recipe.destroy(); // cascades to recipe_ingredients
	return { deleted: true, id: recipe_id };
}

async function addRecipeIngredient(recipe_id, data, user_id) {
	const recipe = await RecipeModel.findByPk(recipe_id);
	if (!recipe) throw new NotFoundError("Recipe not found");
	if (recipe.user_id !== user_id) throw new ForbiddenError("Not your recipe");

	const { food_id, quantity, unit } = data;
	if (!food_id) throw new DataError("food_id is required");
	if (quantity == null || isNaN(quantity) || quantity <= 0) throw new DataError("quantity must be a positive number");
	if (!unit?.trim()) throw new DataError("unit is required");

	const food = await FoodModel.findByPk(food_id, {
		include: [{ model: FoodNutrientModel }, { model: FoodServingSizeModel }],
	});
	if (!food || food.is_deleted) throw new NotFoundError("Food not found");

	toGrams(quantity, unit, food.foodServingSizes); // validate unit

	const nutrients = calcNutrients(quantity, unit, food.foodServingSizes, food.foodNutrients);
	const get = (name) => nutrients[name] ?? nutrients[name.toLowerCase()] ?? null;

	const ingredient = await RecipeIngredientModel.create({
		recipe_id,
		food_id: food.id,
		quantity,
		unit,
		calories: get("Energy") ?? get("Calories") ?? null,
		protein: get("Protein") ?? null,
		carbs: get("Carbohydrate, by difference") ?? get("Carbs") ?? null,
		fat: get("Total lipid (fat)") ?? get("Fat") ?? null,
	});

	return ingredient;
}

async function removeRecipeIngredient(ingredient_id, user_id) {
	if (isNaN(ingredient_id)) throw new DataError("Invalid ingredient id");
	const ingredient = await RecipeIngredientModel.findByPk(ingredient_id, {
		include: [{ model: RecipeModel }],
	});

	if (!ingredient) throw new NotFoundError("Ingredient not found");
	if (ingredient.recipe.user_id !== user_id) throw new ForbiddenError("Not your recipe");

	await ingredient.destroy();
	return { deleted: true, ingredient_id };
}

function formatRecipe(recipe, ingredients, foodMap) {
	const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
	for (const ing of ingredients ?? []) {
		totals.calories += parseFloat(ing.calories ?? 0);
		totals.protein += parseFloat(ing.protein ?? 0);
		totals.carbs += parseFloat(ing.carbs ?? 0);
		totals.fat += parseFloat(ing.fat ?? 0);
	}

	return {
		id: recipe.recipe_id,
		name: recipe.name,
		description: recipe.description,
		servings: parseFloat(recipe.servings),
		created_at: recipe.created_at,
		totals: {
			calories: parseFloat(totals.calories.toFixed(2)),
			protein: parseFloat(totals.protein.toFixed(2)),
			carbs: parseFloat(totals.carbs.toFixed(2)),
			fat: parseFloat(totals.fat.toFixed(2)),
		},
		ingredients: (ingredients ?? []).map((i) => {
			// food name comes from either the joined food association or the foodMap (on create)
			const foodName = i.food?.name ?? foodMap?.[i.food_id]?.name ?? null;
			return {
				ingredient_id: i.ingredient_id,
				food_id: i.food_id,
				food_name: foodName,
				quantity: parseFloat(i.quantity),
				unit: i.unit,
				calories: i.calories != null ? parseFloat(parseFloat(i.calories).toFixed(2)) : null,
				protein: i.protein != null ? parseFloat(parseFloat(i.protein).toFixed(2)) : null,
				carbs: i.carbs != null ? parseFloat(parseFloat(i.carbs).toFixed(2)) : null,
				fat: i.fat != null ? parseFloat(parseFloat(i.fat).toFixed(2)) : null,
			};
		}),
	};
}

module.exports = {
	// Foods
	SearchFoods,
	CreateFood,
	// Diary
	addDiaryEntry,
	getDiaryEntries,
	editDiaryEntry,
	deleteDiaryEntry,
	// Recipes
	createRecipe,
	getRecipes,
	getRecipe,
	updateRecipe,
	deleteRecipe,
	addRecipeIngredient,
	removeRecipeIngredient,
};
