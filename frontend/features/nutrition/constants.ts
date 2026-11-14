import type { MealType, MicronutrientField } from "./types";

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

export type NutrientKey = keyof typeof NUTRIENT_NAME_TO_IDS;

export const NUTRIENT_IDS_TO_NAMES = Object.fromEntries(Object.entries(NUTRIENT_NAME_TO_IDS).map(([key, value]) => [value, key]));

//Units we use all over:
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

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

// The vitamins & minerals section of the create food form, in display order
export const DEFAULT_MICRONUTRIENTS: MicronutrientField[] = [
	// ── Carb & Fat Breakdown ───────────────────────────────
	{ nutrient_name: "fiber", nutrient_id: NUTRIENT_NAME_TO_IDS.FIBER, label: "Fiber", unit: "g", value: "0" },
	{ nutrient_name: "sugar", nutrient_id: NUTRIENT_NAME_TO_IDS.SUGAR, label: "Sugar", unit: "g", value: "0" },
	{ nutrient_name: "added_sugar", nutrient_id: NUTRIENT_NAME_TO_IDS.ADDED_SUGAR, label: "Added sugar", unit: "g", value: "0" },
	{ nutrient_name: "saturated_fat", nutrient_id: NUTRIENT_NAME_TO_IDS.SATURATED_FAT, label: "Saturated fat", unit: "g", value: "0" },
	{ nutrient_name: "trans_fat", nutrient_id: NUTRIENT_NAME_TO_IDS.TRANS_FAT, label: "Trans fat", unit: "g", value: "0" },
	{ nutrient_name: "polyunsaturated_fat", nutrient_id: NUTRIENT_NAME_TO_IDS.POLYUNSATURATED_FAT, label: "Polyunsaturated fat", unit: "g", value: "0" },
	{ nutrient_name: "monounsaturated_fat", nutrient_id: NUTRIENT_NAME_TO_IDS.MONOUNSATURATED_FAT, label: "Monounsaturated fat", unit: "g", value: "0" },

	// ── Minerals ─────────────────────────────────────────────
	{ nutrient_name: "sodium", nutrient_id: NUTRIENT_NAME_TO_IDS.SODIUM, label: "Sodium", unit: "mg", value: "0" },
	{ nutrient_name: "cholesterol", nutrient_id: NUTRIENT_NAME_TO_IDS.CHOLESTEROL, label: "Cholesterol", unit: "mg", value: "0" },
	{ nutrient_name: "calcium", nutrient_id: NUTRIENT_NAME_TO_IDS.CALCIUM, label: "Calcium", unit: "mg", value: "0" },
	{ nutrient_name: "iron", nutrient_id: NUTRIENT_NAME_TO_IDS.IRON, label: "Iron", unit: "mg", value: "0" },
	{ nutrient_name: "potassium", nutrient_id: NUTRIENT_NAME_TO_IDS.POTASSIUM, label: "Potassium", unit: "mg", value: "0" },
	{ nutrient_name: "magnesium", nutrient_id: NUTRIENT_NAME_TO_IDS.MAGNESIUM, label: "Magnesium", unit: "mg", value: "0" },
	{ nutrient_name: "phosphorus", nutrient_id: NUTRIENT_NAME_TO_IDS.PHOSPHORUS, label: "Phosphorus", unit: "mg", value: "0" },
	{ nutrient_name: "zinc", nutrient_id: NUTRIENT_NAME_TO_IDS.ZINC, label: "Zinc", unit: "mg", value: "0" },

	// ── Vitamins ─────────────────────────────────────────────
	{ nutrient_name: "vitamin_a", nutrient_id: NUTRIENT_NAME_TO_IDS.VITAMIN_A, label: "Vitamin A", unit: "µg", value: "0" },
	{ nutrient_name: "vitamin_c", nutrient_id: NUTRIENT_NAME_TO_IDS.VITAMIN_C, label: "Vitamin C", unit: "mg", value: "0" },
	{ nutrient_name: "vitamin_d", nutrient_id: NUTRIENT_NAME_TO_IDS.VITAMIN_D, label: "Vitamin D", unit: "µg", value: "0" },
	{ nutrient_name: "vitamin_e", nutrient_id: NUTRIENT_NAME_TO_IDS.VITAMIN_E, label: "Vitamin E", unit: "mg", value: "0" },
	{ nutrient_name: "vitamin_k", nutrient_id: NUTRIENT_NAME_TO_IDS.VITAMIN_K, label: "Vitamin K", unit: "µg", value: "0" },
	{ nutrient_name: "vitamin_b6", nutrient_id: NUTRIENT_NAME_TO_IDS.VITAMIN_B6, label: "Vitamin B6", unit: "mg", value: "0" },
	{ nutrient_name: "vitamin_b12", nutrient_id: NUTRIENT_NAME_TO_IDS.VITAMIN_B12, label: "Vitamin B12", unit: "µg", value: "0" },
	{ nutrient_name: "folate", nutrient_id: NUTRIENT_NAME_TO_IDS.FOLATE, label: "Folate", unit: "µg", value: "0" },
	{ nutrient_name: "thiamin", nutrient_id: NUTRIENT_NAME_TO_IDS.THIAMIN, label: "Thiamin (B1)", unit: "mg", value: "0" },
	{ nutrient_name: "riboflavin", nutrient_id: NUTRIENT_NAME_TO_IDS.RIBOFLAVIN, label: "Riboflavin (B2)", unit: "mg", value: "0" },
	{ nutrient_name: "niacin", nutrient_id: NUTRIENT_NAME_TO_IDS.NIACIN, label: "Niacin (B3)", unit: "mg", value: "0" },
];
