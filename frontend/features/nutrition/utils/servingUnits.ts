import { FIXED_UNIT_CONVERSIONS, VOLUME_UNITS_TO_ML } from "../constants";
import type { ServingSize } from "../types";

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
//Otherwise does the keyword density fallback on the food's name/brand
export function resolveServingWeightG(unit: string, servingSizes: ServingSize[], foodName: string, foodBrand?: string | null): number | null {
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

		//if we don't have a reliable conversion of other serving sizes, do our best guess here based on known estimated density's
		const gPerMl = estimateDensityForFood(foodName, foodBrand);
		if (gPerMl != null) return gPerMl * VOLUME_UNITS_TO_ML[unit];
	}

	return null;
}

// The quantity to default a logging UI's quantity field to when `unit` is
// selected for this food - "the package said N of this unit is a serving".
// Falls back to 1 when unknown, same as gram math treats a missing row.
export function resolveDefaultQuantity(unit: string, servingSizes: ServingSize[]): number {
	return servingSizes.find((s) => s.label === unit)?.default_quantity ?? 1;
}
