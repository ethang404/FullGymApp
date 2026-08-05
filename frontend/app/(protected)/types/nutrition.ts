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
	id: number;
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
	id: number;
	name: string;
	brand?: string;
	serving_sizes: ServingSize[];
	default_serving: DefaultServing;
	nutrients_per_100g: MacroPer100g[];
}

export const NUTRIENT_NAME_TO_IDS = {
	// ── Core macros ──────────────────────────────────────────
	ENERGY: 1008,
	PROTEIN: 1003,
	FAT: 1004,
	CARBS: 1005,

	// ── Carb breakdown ───────────────────────────────────────
	FIBER: 1079,
	SUGAR: 2000,
	ADDED_SUGAR: 1235,

	// ── Fat breakdown ────────────────────────────────────────
	SATURATED_FAT: 1258,
	TRANS_FAT: 1257,
	POLYUNSATURATED_FAT: 1293,
	MONOUNSATURATED_FAT: 1292,

	// ── Minerals ─────────────────────────────────────────────
	SODIUM: 1093,
	CHOLESTEROL: 1253,
	CALCIUM: 1087,
	IRON: 1089,
	POTASSIUM: 1092,
	MAGNESIUM: 1090,
	PHOSPHORUS: 1091,
	ZINC: 1095,

	// ── Vitamins ─────────────────────────────────────────────
	VITAMIN_A: 1106,
	VITAMIN_C: 1162,
	VITAMIN_D: 1114,
	VITAMIN_E: 1109,
	VITAMIN_K: 1185,
	VITAMIN_B6: 1175,
	VITAMIN_B12: 1178,
	FOLATE: 1177,
	THIAMIN: 1165,
	RIBOFLAVIN: 1166,
	NIACIN: 1167,
} as const;

export const NUTRIENT_IDS_TO_NAMES = Object.fromEntries(Object.entries(NUTRIENT_NAME_TO_IDS).map(([key, value]) => [value, key]));

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

	/* const get = (nutrientId: number) => {
		const per100 = nutrients.find((n) => n.nutrient_id === nutrientId)?.amount_per_100g;
		return per100 != null ? (per100 * grams) / 100 : undefined;
	}; */
	return nutrients.map((nutrient) => ({
		...nutrient,
		amount: (nutrient.amount_per_100g * grams) / 100,
	}));
}

//Recipe screens
export interface RecipeIngredient {
	id: string; // local-only id, e.g. `${food.id}-${Date.now()}`
	food: FoodSearchResult;
	quantity: number;
	serving: ServingSize;
	cals: number;
	protein: number;
	carbs: number;
	fat: number;
}

//Constants we use all over:
export const COMMON_UNITS = ["oz", "lb", "kg", "cup", "tbsp", "tsp", "ml"];
export const SERVING_UNIT_OPTIONS: string[] = ["g", "kg", "oz", "lb", "ml", "l", "cup", "tbsp", "tsp", "slice", "piece", "serving"];
export const FIXED_UNIT_CONVERSIONS: Record<string, number> = {
	g: 1,
	kg: 1000,
	lb: 453.592,
	oz: 28.3495,
	mg: 0.001,
};
