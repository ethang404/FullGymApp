// Fixtures for explore.test.js — mirrors the FriendsPayloads.js / NutritionPayloads.js convention.

const userAPayload = {
	firstName: "Avery",
	lastName: "Adams",
	userName: "explore_avery",
	password: "ExploreUser123!",
};

const userBPayload = {
	firstName: "Blair",
	lastName: "Booker",
	userName: "explore_blair",
	password: "ExploreUser123!",
};

const userCPayload = {
	firstName: "Charlie",
	lastName: "Cross",
	userName: "explore_charlie",
	password: "ExploreUser123!",
};

// Minimal food, shared by every recipe created in this suite - only the macros needed to
// make serializeRecipeSummary's math run, nothing else about the food matters here.
const foodPayload = {
	name: "Explore Test Oats",
	brand: null,
	barcode: null,
	nutrients: [
		{ nutrient_id: 1008, nutrient_name: "calories", unit: "kcal", nutrient_amount: 150 },
		{ nutrient_id: 1003, nutrient_name: "protein", unit: "g", nutrient_amount: 5 },
		{ nutrient_id: 1005, nutrient_name: "carbs", unit: "g", nutrient_amount: 27 },
		{ nutrient_id: 1004, nutrient_name: "fat", unit: "g", nutrient_amount: 3 },
	],
	serving_sizes: [{ label: "serving", weight_g: 40 }],
};

function recipePayload(name, visibility, food_id) {
	return { name, visibility, servings: 1, ingredients: [{ food_id, quantity: 1, unit: "serving" }] };
}

function workoutPayload(name, visibility, workout_date = "2026-01-01") {
	return { workout_name: name, workout_date, visibility, exercises: [] };
}

module.exports = { userAPayload, userBPayload, userCPayload, foodPayload, recipePayload, workoutPayload };
