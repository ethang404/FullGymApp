import { NUTRIENT_NAME_TO_IDS, type NutrientKey } from "../constants";
import type { CalculatedNutrient, MacroPer100g, RecipeIngredient } from "../types";

export function calcMacrosFromPer100g(
	quantity: number,
	unitWeightG: number,
	nutrients: MacroPer100g[],
): { cals?: number; protein?: number; carbs?: number; fat?: number } {
	const grams = quantity * unitWeightG;

	const get = (nutrientId: number) => {
		const per100 = nutrients.find((n) => n.nutrient_id === nutrientId)?.amount_per_100g;
		return per100 != null ? (per100 * grams) / 100 : undefined;
	};

	return {
		cals: get(NUTRIENT_NAME_TO_IDS.ENERGY),
		protein: get(NUTRIENT_NAME_TO_IDS.PROTEIN),
		carbs: get(NUTRIENT_NAME_TO_IDS.CARBS),
		fat: get(NUTRIENT_NAME_TO_IDS.FAT),
	};
}

//returns entire array of all converted nutrients
//quantity, serving_weight_in_grams, and how much in 100g basis from database
export function calcNutrientsFromPer100g(quantity: number, unitWeightG: number, nutrients: MacroPer100g[]): CalculatedNutrient[] {
	const grams = quantity * unitWeightG;

	return nutrients.map((nutrient) => ({
		...nutrient,
		amount: (nutrient.amount_per_100g * grams) / 100,
	}));
}

//Totals for a whole recipe: every ingredient's nutrients summed, plus the total weight
export function calcRecipeTotals(ingredients: RecipeIngredient[]) {
	let totalWeightG = 0;
	const aggregatedById: Record<number, number> = {};

	ingredients.forEach((ing) => {
		const ingWeightG = ing.quantity * ing.serving.weight_g;
		totalWeightG += ingWeightG;

		const calculated = calcNutrientsFromPer100g(ing.quantity, ing.serving.weight_g, ing.food.nutrients_per_100g);

		calculated.forEach((n) => {
			aggregatedById[n.nutrient_id] = (aggregatedById[n.nutrient_id] || 0) + n.amount;
		});
	});

	//aggregatedById is dict of each nutrientId summed together across all ingrediants

	// Map nutrient IDs to their string keys for Nutritional label(e.g. { PROTEIN: 29.2, FAT: 8.72 })
	const nutrientsByKey: Partial<Record<NutrientKey, number>> = {};

	//Get all key names from NUTRIENT_NAME_TO_IDS as an array, and tell TypeScript these are type nutrient names
	const nutrientKeys = Object.keys(NUTRIENT_NAME_TO_IDS) as NutrientKey[]; //array of nutrient keys

	nutrientKeys.forEach((key) => {
		//actual storage for nutrient values
		const id = NUTRIENT_NAME_TO_IDS[key];
		nutrientsByKey[key] = aggregatedById[id] ?? 0;
	});

	return {
		protein: nutrientsByKey.PROTEIN ?? 0,
		carbs: nutrientsByKey.CARBS ?? 0,
		fat: nutrientsByKey.FAT ?? 0,
		calories: nutrientsByKey.ENERGY ?? 0,
		weight: totalWeightG,
		nutrients: nutrientsByKey,
	};
}
