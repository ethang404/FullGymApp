const { DataError } = require("../error");
const { resolveUnitWeightG } = require("./unitConversion");

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

//calories, protein, carbs, fat - search results and recents only load these for performance
const MACRO_IDS = [1008, 1003, 1005, 1004];

/**
 * Expected: (quantity, unit, servingSizes, foodMeta?: { name, brand })
 * Resolves the unit to a per-unit gram weight via resolveUnitWeightG (exact
 * serving-size match, fixed mass units, derived volume ratio, or density
 * fallback keyed off foodMeta) and throws if nothing resolves.
 */
const toGrams = (quantity, unit, servingSizes, foodMeta = {}) => {
	const perUnitG = resolveUnitWeightG(unit, servingSizes, foodMeta.name, foodMeta.brand);
	if (perUnitG == null) throw new DataError(`Unit "${unit}" is not available for this food`);
	return quantity * perUnitG;
};

//This converts from our database 100g basis to whatever amount the user chose
const calcNutrients = (quantity, unit, servingSizes, nutrients, foodMeta = {}) => {
	const grams = toGrams(quantity, unit, servingSizes, foodMeta);

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

//given raw nutrient ID's in an array, return macro names with amounts in dictionary
function mapNutrients(rawNutrients) {
	const mapped = {};
	for (const n of rawNutrients) {
		const key = ID_TO_DISPLAY[n.nutrient_id];
		if (key) mapped[key] = parseFloat(n.amount) || 0;
	}
	return mapped;
}

//sum nutrients to however much the user logged/ate
//so like if the recipe makes 10 servings, and we ate 1. Scale is 0.1 so we scale ingrediants down
function scaleRecipeNutrients(recipeIngredients, scale) {
	const totals = {};

	for (const ing of recipeIngredients ?? []) {
		const raw_nutrients = calcNutrients(parseFloat(ing.quantity), ing.unit, ing.food.foodServingSizes, ing.food.foodNutrients, {
			name: ing.food.name,
			brand: ing.food.brand,
		});

		for (const n of raw_nutrients) {
			totals[n.nutrient_id] = (totals[n.nutrient_id] ?? 0) + n.amount;
		}
	}

	return Object.entries(totals).map(([nutrient_id, total]) => ({
		nutrient_id: parseInt(nutrient_id),
		amount: parseFloat((total * scale).toFixed(4)),
	}));
}

module.exports = { NUTRIENT_MAP, MACRO_IDS, toGrams, calcNutrients, mapNutrients, scaleRecipeNutrients };
