//Response shapes for foods, recipes and diary entries. Services load the rows (with the includes listed on each), these shape them.
const { calcNutrients, mapNutrients, scaleRecipeNutrients } = require("../Nutrition/nutrients");

//food.foodServingSizes -> [{ label, weight_g, default_quantity }] with numbers instead of DECIMAL strings
function serializeServingSizes(servingSizes) {
	return (servingSizes ?? []).map(({ label, weight_g, default_quantity }) => ({
		label,
		weight_g: parseFloat(weight_g),
		default_quantity: default_quantity != null ? parseFloat(default_quantity) : null,
	}));
}

//we use this data to convert on frontend for display purposes
function serializeNutrientsPer100g(nutrients) {
	return (nutrients ?? []).map((n) => ({
		nutrient_id: n.nutrient_id,
		name: n.nutrient_name,
		unit: n.unit,
		amount_per_100g: parseFloat(n.amount_per_100g),
	}));
}

// ---------------------------------------------
// FOODS (include foodNutrients + foodServingSizes)
// ---------------------------------------------

//GET /foods/:id
function serializeFood(food) {
	const { foodNutrients, foodServingSizes, ...foodJson } = food.toJSON();
	return {
		...foodJson,
		serving_sizes: serializeServingSizes(foodServingSizes),
		nutrients_per_100g: serializeNutrientsPer100g(foodNutrients),
	};
}

/**
 * Search result shape: serving_sizes, default_serving w/ macros, nutrients_per_100g.
 * Shared by SearchFoods and getRecentLogged so both return an identical shape.
 */
function serializeFoodSearchResult(food) {
	const { foodNutrients, foodServingSizes, ...foodJson } = food.toJSON();

	const servingSizes = serializeServingSizes(foodServingSizes);
	const nutrients = foodNutrients ?? [];

	const fallback = { label: "g", weight_g: 100, default_quantity: null }; //use a fallback of 100g basis stored in db if we have no serving size data.

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
			default_quantity: displayServing.default_quantity ?? null,
			macros: calcNutrients(quantity, unit, servingSizes, nutrients, { name: foodJson.name, brand: foodJson.brand }),
		},
		nutrients_per_100g: serializeNutrientsPer100g(nutrients),
	};
}

// ---------------------------------------------
// RECIPES
// ---------------------------------------------

/**
 * List summary (id, name, servings, *_per_serving) using the macros pre-stored on each ingredient row.
 * Include: recipeIngredients. Shared by getRecipes and getRecentLogged.
 */
function serializeRecipeSummary(recipe) {
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
		id: recipe.recipe_id,
		calories_per_serving: Math.round(totals.total_calories / servings),
		protein_per_serving: Math.round(totals.total_protein / servings),
		carbs_per_serving: Math.round(totals.total_carbs / servings),
		fat_per_serving: Math.round(totals.total_fat / servings),
	};
}

/**
 * Detail page: every ingredient with live nutrients from its food, plus recipe totals and per serving.
 * Include: recipeIngredients -> food -> foodNutrients + foodServingSizes
 */
function serializeRecipeDetail(recipe) {
	const servingsRaw = parseFloat(recipe.servings);
	const servings = servingsRaw > 0 ? servingsRaw : 1; //handle NaN/0 issues

	// Recompute nutrients live from each ingredient's food data
	const ingredients = (recipe.recipeIngredients ?? []).map((ing) => {
		const raw_nutrients = calcNutrients(parseFloat(ing.quantity), ing.unit, ing.food.foodServingSizes, ing.food.foodNutrients, {
			name: ing.food.name,
			brand: ing.food.brand,
		});

		return {
			ingredient_id: ing.ingredient_id,
			food_id: ing.food_id,
			food_name: ing.food.name,
			serving_sizes: serializeServingSizes(ing.food.foodServingSizes),
			quantity: parseFloat(ing.quantity),
			unit: ing.unit,
			nutrients: mapNutrients(raw_nutrients),
			nutrients_per_100g: serializeNutrientsPer100g(ing.food.foodNutrients),
		};
	});

	// Sum every nutrient across all ingredients to show totals for recipe
	const totals = {};
	for (const ing of ingredients) {
		for (const [key, amount] of Object.entries(ing.nutrients)) {
			totals[key] = (totals[key] ?? 0) + amount;
		}
	}

	//divide by serving count to show per serving values
	const per_serving = {};
	for (const [key, amount] of Object.entries(totals)) {
		per_serving[key] = parseFloat((amount / servings).toFixed(2));
	}

	const { recipeIngredients: _raw, ...recipeJson } = recipe.toJSON();

	return {
		...recipeJson,
		calories_per_serving: Math.round(per_serving.calories ?? 0),
		protein_per_serving: Math.round(per_serving.protein ?? 0),
		carbs_per_serving: Math.round(per_serving.carbs ?? 0),
		fat_per_serving: Math.round(per_serving.fat ?? 0),
		totals,
		per_serving,
		ingredients,
	};
}

// ---------------------------------------------
// DIARY ENTRIES (include DIARY_INCLUDE in Nutrition/service.js)
// ---------------------------------------------

//null for a row with neither a food nor a recipe (left over from old hard deletes) - callers filter those out
function serializeDiaryEntry(e) {
	const base = {
		id: e.id,
		meal_type: e.meal_type,
		logged_at: e.logged_at,
		quantity: parseFloat(e.quantity),
		unit: e.unit,
	};

	if (e.food_id) {
		const raw_nutrients = calcNutrients(e.quantity, e.unit, e.food.foodServingSizes, e.food.foodNutrients, {
			name: e.food.name,
			brand: e.food.brand,
		});
		return {
			...base,
			type: "food",
			food: { id: e.food.id, name: e.food.name, brand: e.food.brand },
			nutrients: mapNutrients(raw_nutrients),
		};
	}

	if (e.recipe_id) {
		const scale = parseFloat(e.quantity) / parseFloat(e.recipe.servings);
		const raw_nutrients = scaleRecipeNutrients(e.recipe.recipeIngredients, scale);
		return {
			...base,
			type: "recipe",
			recipe: {
				id: e.recipe.recipe_id,
				name: e.recipe.name,
				servings: parseFloat(e.recipe.servings),
				is_deleted: e.recipe.is_deleted, //still counts in your history, frontend can mark it "(deleted)"
			},
			nutrients: mapNutrients(raw_nutrients),
		};
	}

	return null;
}

module.exports = {
	serializeFood,
	serializeFoodSearchResult,
	serializeRecipeSummary,
	serializeRecipeDetail,
	serializeDiaryEntry,
};
