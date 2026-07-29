//These are for LogFoodModal + serving size for AddServingModal:
//For handling API return things
export interface ServingSize {
	label: string;
	weight_g: number;
}

export interface MacroPer100g {
	nutrient_id: number;
	name: string;
	unit: string;
	amount_per_100g: number;
}

export interface CalculatedNutrient extends MacroPer100g {
	//we use this to calculate all nutrients vals with our conversions
	amount: number; //stores converted amounts
}

export interface FoodDetail {
	id: string;
	name: string;
	brand?: string | null;
	serving_sizes: ServingSize[];
	nutrients_per_100g: MacroPer100g[];
}

export interface Macro {
	nutrient_id: number;
	name: string;
	unit: string;
	amount: number;
}

export interface DefaultServing {
	label: string; // like "oz" or "serving"
	weight_g: number;
	macros: Macro[];
}

export interface FoodSearchResult {
	id: string;
	name: string;
	brand?: string;
	serving_sizes: ServingSize[];
	default_serving: DefaultServing;
	nutrients_per_100g: MacroPer100g[];
}

export const NUTRIENT_IDS = {
	ENERGY: 1008,
	PROTEIN: 1003,
	CARBS: 1005,
	FAT: 1004,
} as const;

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
		cals: get(NUTRIENT_IDS.ENERGY),
		protein: get(NUTRIENT_IDS.PROTEIN),
		carbs: get(NUTRIENT_IDS.CARBS),
		fat: get(NUTRIENT_IDS.FAT),
	};
}

//returns entire array of all converted nutrients
//quantity, serving_weight_in_grams, and how much in 100g basis from database
export function calcNutrientsFromPer100g(quantity: number, unitWeightG: number, nutrients: MacroPer100g[]): CalculatedNutrient[] {
	const grams = quantity * unitWeightG;

	/* const get = (nutrientId: number) => {
		const per100 = nutrients.find((n) => n.nutrient_id === nutrientId)?.amount_per_100g;
		return per100 != null ? (per100 * grams) / 100 : undefined;
	}; */
	return nutrients.map((nutrient) => ({
		...nutrient,
		amount: (nutrient.amount_per_100g * grams) / 100,
	}));
}

//Constants we use all over:
export const COMMON_UNITS = ["oz", "lb", "kg", "cup", "tbsp", "tsp", "ml"];
export const FIXED_UNIT_CONVERSIONS: Record<string, number> = {
	kg: 1000,
	lb: 453.592,
	oz: 28.3495,
	mg: 0.001,
};
