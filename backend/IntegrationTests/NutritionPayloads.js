//#region AddWorkoutVars
const addUserPayload = {
	firstName: "Ethan",
	lastName: "Gordon",
	userName: "egor2",
	password: "passy",
};

//#region NutritionVars

// CreateFood validates: nutrient_id, nutrient_name, unit, nutrient_amount (not amount_per_100g)
// and checks NUTRIENT_MAP[nutrient_name] - so nutrient_name must be a key in NUTRIENT_MAP
// It also normalizes from serving basis to per-100g using serving_sizes[0].weight_g
const addFoodPayload = {
	name: "Chicken Breast",
	brand: "Generic",
	barcode: null,
	nutrients: [
		{ nutrient_id: 1008, nutrient_name: "calories", unit: "kcal", nutrient_amount: 231 }, // 165 kcal per 100g * 1.4 serving
		{ nutrient_id: 1003, nutrient_name: "protein", unit: "g", nutrient_amount: 43.4 }, // 31g per 100g * 1.4
		{ nutrient_id: 1005, nutrient_name: "carbs", unit: "g", nutrient_amount: 0 },
		{ nutrient_id: 1004, nutrient_name: "fat", unit: "g", nutrient_amount: 5.04 }, // 3.6g per 100g * 1.4
	],
	serving_sizes: [
		{ label: "serving", weight_g: 140 }, // 1 serving = 140g — used as normalization basis
		{ label: "oz", weight_g: 28.35 },
	],
};

// Diary entry using grams - no food_serving_sizes lookup needed
const addDiaryEntryPayload = {
	food_id: null, // set dynamically in test after food is created
	meal_type: "lunch",
	logged_at: "2025-01-15",
	quantity: 200,
	unit: "g",
};

// Edit diary entry
const editDiaryEntryPayload = {
	quantity: 150,
	unit: "g",
	meal_type: "dinner",
	logged_at: "2025-01-15",
};

// Diary entry using a named serving size (tests food_serving_sizes lookup)
const addDiaryEntryServingPayload = {
	food_id: null, // set dynamically
	meal_type: "dinner",
	logged_at: "2025-01-15",
	quantity: 2,
	unit: "serving", // 2 servings = 2 * 140g = 280g
};
//#endregion

//#region RecipeVars
const createRecipePayload = {
	name: "High Protein Lunch",
	description: "Simple high protein meal",
	servings: 2,
	ingredients: [
		{
			food_id: null, // set dynamically after food is created
			quantity: 200,
			unit: "g",
		},
	],
};
//#endregion

module.exports = {
	addUserPayload,
	// Nutrition
	addFoodPayload,
	addDiaryEntryPayload,
	editDiaryEntryPayload,
	addDiaryEntryServingPayload,
	createRecipePayload,
};
