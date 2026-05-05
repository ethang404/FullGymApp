const { NotFoundError, DataError, ForbiddenError } = require("../error");

/**
 * Validates YYYY-MM-DD date strings
 */
function isValidDate(str) {
	return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str));
}

// ---------------------------------------------
// HELPERS (Logic Removed)
// ---------------------------------------------

/**
 * Expected: (quantity: number, unit: string, servingSizes: Array)
 * Logic: Should find the unit in servingSizes and return the weight in grams.
 */
const toGrams = (quantity, unit, servingSizes) => {
    // Check if unit is 'g', 'kg', or matches a servingSizes label
    // Throw DataError if unit is invalid for this food
};

/**
 * Expected: (quantity: number, unit: string, servingSizes: Array, nutrients: Array)
 * Logic: Should calculate nutrient totals based on the weight in grams relative to a 100g base.
 */
const calcNutrients = (quantity, unit, servingSizes, nutrients) => {
    // Use toGrams to get total weight
    // Return an object: { nutrient_name: calculated_amount }
};

/**
 * Expected: (ingredients: Array, scale: number)
 * Logic: Should scale the snapshot macros of a recipe by the portion eaten.
 */
const scaleMacros = (ingredients, scale) => {
    // Reduce ingredients to sum: calories, protein, carbs, fat
    // Multiply by scale and return the object
};

// ---------------------------------------------
// FOODS
// ---------------------------------------------

/**
 * GET /foods?query=...
 * Expected: query (string)
 */
async function SearchFoods(query) {
	if (!query || query.trim().length === 0) throw new DataError("Search query is required");

	// TODO: Core Search Logic (Full-text, trigram, ILIKE)
    // TODO: Map results using formatFood
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
		if (n.amount_per_100g == null || isNaN(n.amount_per_100g)) throw new DataError("Each nutrient must have a valid amount_per_100g");
	}

	for (const s of data.serving_sizes) {
		if (!s.label?.trim()) throw new DataError("Each serving size must have a label");
		if (s.weight_g == null || isNaN(s.weight_g) || s.weight_g <= 0) throw new DataError("Each serving size must have a valid weight_g");
	}

	// TODO: Database Transaction
    // 1. Create FoodModel (source: "user_submitted")
    // 2. bulkCreate FoodNutrientModel
    // 3. bulkCreate FoodServingSizeModel
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
	}

	if (recipe_id) {
		if (unit !== "serving") throw new DataError('Recipe entries must use unit: "serving"');
		// TODO: Fetch recipe, check ownership, Create DiaryEntry
	}
}

/**
 * GET /diary?start_date=...&end_date=...
 * Expected: start_date (YYYY-MM-DD), end_date?, meal_type?
 */
async function getDiaryEntries(user_id, start_date, end_date, meal_type) {
	if (!start_date || !isValidDate(start_date)) throw new DataError("start_date must be YYYY-MM-DD");
	if (end_date && !isValidDate(end_date)) throw new DataError("end_date must be YYYY-MM-DD");

	// TODO: Fetch DiaryEntries with joins (Food+Nutrients+ServingSizes or Recipe+Ingredients)
    // TODO: Calculate nutrients for each entry (calcNutrients for food, scaleMacros for recipes)
}

/**
 * PUT /diary/:id
 * Expected: data { quantity?, unit?, meal_type?, logged_at? }
 */
async function editDiaryEntry(entry_id, data, user_id) {
	if (isNaN(entry_id)) throw new DataError("Invalid entry id");

	// TODO: Fetch entry and check ownership
    // TODO: Re-validate unit if quantity/unit changed
    // TODO: Update entry and return full recalculated object (re-join everything)
}

// ---------------------------------------------
// RECIPES
// ---------------------------------------------

/**
 * POST /recipes
 * Expected: { name, description?, servings?, ingredients: [{ food_id, quantity, unit }] }
 */
async function createRecipe(data, user_id) {
	const { name, description, servings, ingredients } = data;

	if (!name?.trim()) throw new DataError("Recipe name is required");
	if (!Array.isArray(ingredients) || ingredients.length === 0) throw new DataError("At least one ingredient is required");

	// TODO: Batch-load foods to check existence and get nutrient data
    // TODO: Transactional creation:
    // 1. Create Recipe
    // 2. Calculate nutrient snapshots for each ingredient via calcNutrients
    // 3. bulkCreate RecipeIngredients with snapshot macros (calories, protein, carbs, fat)
}

/**
 * POST /recipes/:id/ingredients
 * Expected: { food_id, quantity, unit }
 */
async function addRecipeIngredient(recipe_id, data, user_id) {
    // TODO: Validate food and ownership of recipe
    // TODO: Calculate snapshot nutrients for this food at this quantity
    // TODO: Create RecipeIngredient row
}

module.exports = {
	SearchFoods, CreateFood,
	addDiaryEntry, getDiaryEntries, editDiaryEntry,
	createRecipe, addRecipeIngredient,
    // ... rest of exports
};