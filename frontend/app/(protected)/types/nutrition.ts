//These are for LogFoodModal + serving size for AddServingModal:
//For handling API return things
export interface ServingSize {
	label: string;
	weight_g: number;
	// "The package's stated serving was actually N of this unit" - pure UX
	// metadata, never used in gram math. null/undefined = unknown, treat as 1.
	default_quantity?: number | null;
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
	default_quantity?: number | null;
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
	baseQuantity: number;
	serving: ServingSize;
	cals: number;
	protein: number;
	carbs: number;
	fat: number;
}

//Constants we use all over:
export const COMMON_UNITS = ["oz", "fl oz", "lb", "kg", "cup", "tbsp", "tsp", "ml"];
export const SERVING_UNIT_OPTIONS: string[] = ["g", "kg", "mg", "oz", "fl oz", "lb", "ml", "l", "cup", "tbsp", "tsp", "slice", "piece", "serving"];
export const FIXED_UNIT_CONVERSIONS: Record<string, number> = {
	g: 1,
	kg: 1000,
	lb: 453.592,
	oz: 28.3495,
	mg: 0.001,
};

// Volume units per 1ml. Mirrors the backend's
// VOLUME_UNITS_TO_ML in backend/Nutrition/unitConversion.js.
export const VOLUME_UNITS_TO_ML: Record<string, number> = {
	ml: 1,
	l: 1000,
	tsp: 5,
	tbsp: 15,
	"fl oz": 30,
	cup: 240,
};

// Category-keyword density fallback (g per mL aka density of liquid) - mirrors the backend's
// DENSITY_FALLBACK_TABLE in backend/Nutrition/unitConversion.js. KEEP IN SYNC

//Basically if we find no other conversion method this is our best guess
const DENSITY_FALLBACK_TABLE: { keywords: string[]; gPerMl: number }[] = [
	{ keywords: ["olive oil", "vegetable oil", "canola oil", "coconut oil", "sesame oil", "oil"], gPerMl: 0.92 },
	{ keywords: ["honey"], gPerMl: 1.42 },
	{ keywords: ["maple syrup", "corn syrup", "syrup"], gPerMl: 1.33 },
	{ keywords: ["heavy cream", "whipping cream", "half and half", "cream"], gPerMl: 1.01 },
	{ keywords: ["yogurt", "yoghurt"], gPerMl: 1.03 },
	{ keywords: ["milk"], gPerMl: 1.03 },
	{ keywords: ["vinegar"], gPerMl: 1.01 },
	{ keywords: ["wine"], gPerMl: 0.99 },
	{ keywords: ["beer"], gPerMl: 1.01 },
	{ keywords: ["juice"], gPerMl: 1.04 },
	{ keywords: ["soda", "cola", "soft drink"], gPerMl: 1.04 },
	{ keywords: ["water"], gPerMl: 1.0 },
];

//fallback here
export function estimateDensityForFood(name: string, brand?: string | null): number | null {
	const haystack = `${name ?? ""} ${brand ?? ""}`.toLowerCase();
	for (const { keywords, gPerMl } of DENSITY_FALLBACK_TABLE) {
		for (const kw of keywords) {
			const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			if (new RegExp(`\\b${escaped}\\b`, "i").test(haystack)) return gPerMl;
		}
	}
	return null;
}

//MIRRORS backend, KEEP IN SYNC
//Attempts direct conversions if solid or already have
//Tries to get density using other serving sizes we can convert betweeen
//Otherwise does fallback
export function resolveServingWeightG(unit: string, servingSizes: ServingSize[]): number | null {
	if (unit === "g") return 1;
	if (unit === "kg") return 1000; //other solid foods generally

	const explicit = servingSizes.find((s) => s.label === unit);
	if (explicit) return explicit.weight_g;

	if (FIXED_UNIT_CONVERSIONS[unit] != null) return FIXED_UNIT_CONVERSIONS[unit]; //generally solid foods

	if (VOLUME_UNITS_TO_ML[unit] != null) {
		for (const s of servingSizes) {
			const knownMlPerUnit = VOLUME_UNITS_TO_ML[s.label];
			if (knownMlPerUnit != null) {
				const gPerMl = s.weight_g / knownMlPerUnit; //density of food liquid (g/mL)
				return gPerMl * VOLUME_UNITS_TO_ML[unit];
			}
		}
	}

	return null;
}

// The quantity to default a logging UI's quantity field to when `unit` is
// selected for this food - "the package said N of this unit is a serving".
// Falls back to 1 when unknown, same as gram math treats a missing row.
export function resolveDefaultQuantity(unit: string, servingSizes: ServingSize[]): number {
	return servingSizes.find((s) => s.label === unit)?.default_quantity ?? 1;
}
