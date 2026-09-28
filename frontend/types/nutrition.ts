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

// Recipe list summary — shape returned by GET /nutrition/recipes and by the
// recipe entries of GET /nutrition/recent. Enough to render a card and log it.
export interface RecipeSummary {
	id: string;
	name: string;
	servings: number;
	calories_per_serving: number;
	protein_per_serving: number;
	carbs_per_serving: number;
	fat_per_serving: number;
}

// One entry from GET /nutrition/recent — a recently logged food or recipe,
// shaped so the same cards (FoodCard / RecipeLogCard) can render it.
export type RecentLoggedItem = { type: "food"; food: FoodSearchResult } | { type: "recipe"; recipe: RecipeSummary };

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

// Shape returned by POST /nutrition/recipes/import — a recipe web page's
// schema.org JSON-LD, normalized into flat arrays. Nothing is persisted; the
// client matches `ingredients` strings to foods and then calls POST /recipes.
export interface ImportedRecipeNutrition {
	calories: number | null;
	protein_g: number | null;
	carbs_g: number | null;
	fat_g: number | null;
	saturated_fat_g: number | null;
	fiber_g: number | null;
	sugar_g: number | null;
	sodium_mg: number | null;
	cholesterol_mg: number | null;
	serving_size: string | null;
}

export interface ImportedRecipe {
	source_url: string;
	name: string | null;
	description: string | null;
	author: string | null;
	image: string | null;
	servings: number | null;
	recipe_yield: string[];
	prep_time_minutes: number | null;
	cook_time_minutes: number | null;
	total_time_minutes: number | null;
	ingredients: string[];
	instructions: string[];
	nutrition: ImportedRecipeNutrition | null;
	keywords: string[];
	categories: string[];
	cuisines: string[];
}

// ---------------------------------------------
// Imported-ingredient parsing/matching — turns one raw recipeIngredient string
// ("2 lbs 93% lean ground turkey (can sub chicken)") into something we can act
// on: a quantity + unit to build a RecipeIngredient with, and a cleaned
// searchText to hand to GET /nutrition/foods?q=. Recipe prose isn't structured
// data, so this is best-effort - any of the three fields can come back a guess.
// ---------------------------------------------

const UNICODE_FRACTIONS: Record<string, number> = {
	"¼": 0.25,
	"½": 0.5,
	"¾": 0.75,
	"⅓": 1 / 3,
	"⅔": 2 / 3,
	"⅛": 0.125,
	"⅜": 0.375,
	"⅝": 0.625,
	"⅞": 0.875,
};

// Consumes a leading amount: "1 1/2" / "1-1/2" / "1/2" / "½" / "1½" / "2.5" / "2".
// Returns null when the line doesn't start with a number at all ("salt to taste").
function parseLeadingAmount(text: string): { value: number; rest: string } | null {
	const s = text.trimStart();

	let m = s.match(/^(\d+)[\s-](\d+)\/(\d+)\b/); // "1 1/2" or "1-1/2"
	if (m) return { value: parseFloat(m[1]) + parseFloat(m[2]) / parseFloat(m[3]), rest: s.slice(m[0].length) };

	m = s.match(/^(\d+)\/(\d+)\b/); // "1/2"
	if (m) return { value: parseFloat(m[1]) / parseFloat(m[2]), rest: s.slice(m[0].length) };

	m = s.match(/^(\d+)([¼½¾⅓⅔⅛⅜⅝⅞])/); // "1½"
	if (m) return { value: parseFloat(m[1]) + UNICODE_FRACTIONS[m[2]], rest: s.slice(m[0].length) };

	m = s.match(/^([¼½¾⅓⅔⅛⅜⅝⅞])/); // "½"
	if (m) return { value: UNICODE_FRACTIONS[m[1]], rest: s.slice(m[0].length) };

	m = s.match(/^(\d+(?:\.\d+)?)/); // "2" or "2.5"
	if (m) return { value: parseFloat(m[1]), rest: s.slice(m[0].length) };

	return null;
}

// Recipe-prose unit words -> the canonical tokens this app already knows how
// to convert (COMMON_UNITS / SERVING_UNIT_OPTIONS / resolveServingWeightG).
// Order matters where phrases overlap ("fl oz" must be tried before "oz").
const UNIT_ALIASES: [RegExp, string][] = [
	[/^fl(?:uid)?\.?\s*oz\.?s?\b/i, "fl oz"],
	[/^tablespoons?\b|^tbsp\.?s?\b|^tbs\.?\b/i, "tbsp"],
	[/^teaspoons?\b|^tsp\.?s?\b/i, "tsp"],
	[/^cups?\b/i, "cup"],
	[/^ounces?\b|^oz\.?s?\b/i, "oz"],
	[/^pounds?\b|^lbs?\.?\b/i, "lb"],
	[/^kilograms?\b|^kgs?\b/i, "kg"],
	[/^grams?\b|^g\b/i, "g"],
	[/^milliliters?\b|^millilitres?\b|^ml\b/i, "ml"],
	[/^liters?\b|^litres?\b|^l\b/i, "l"],
	[/^slices?\b/i, "slice"],
	[/^pieces?\b/i, "piece"],
	[/^servings?\b/i, "serving"],
	[/^cloves?\b/i, "clove"],
	[/^cans?\b/i, "can"],
	[/^packages?\b|^pkgs?\.?\b/i, "package"],
];

// Drops parenthetical asides, including nested ones ("(peeled and seeded (1
// cup grated))") - a single-level regex (\([^)]*\)) only eats up to the first
// ")" it finds, leaving a stray unmatched ")" dangling on nested input.
function stripParentheticals(s: string): string {
	let out = "";
	let depth = 0;
	for (const ch of s) {
		if (ch === "(") {
			depth++;
			out += " "; // keep a boundary so words on either side don't fuse
			continue;
		}
		if (ch === ")") {
			if (depth > 0) depth--;
			continue;
		}
		if (depth === 0) out += ch;
	}
	return out;
}

function matchLeadingUnit(text: string): { unit: string; rest: string } | null {
	const s = text.trimStart();
	for (const [re, unit] of UNIT_ALIASES) {
		const m = s.match(re);
		if (m) return { unit, rest: s.slice(m[0].length) };
	}
	return null;
}

export interface ParsedIngredientLine {
	quantity: number | null;
	unit: string | null; // a token from COMMON_UNITS/SERVING_UNIT_OPTIONS, or null if unrecognized
	searchText: string; // cleaned food name - safe to hand to GET /nutrition/foods?q=
}

export function parseIngredientLine(line: string): ParsedIngredientLine {
	let s = stripParentheticals(line)
		.replace(/\s+/g, " ")
		.trim();

	let quantity: number | null = null;
	const amount = parseLeadingAmount(s);
	if (amount) {
		quantity = amount.value;
		s = amount.rest.trim();
	}

	// ranges ("2-3 tbsp", "2 to 3 cups") - keep the first number, drop the rest
	s = s.replace(/^(?:-|to)\s*\d+(?:[./]\d+)?\s*/i, "");

	let unit: string | null = null;
	const unitMatch = matchLeadingUnit(s);
	if (unitMatch) {
		unit = unitMatch.unit;
		s = unitMatch.rest.trim();
	}

	s = s.replace(/^of\s+/i, ""); // "2 cups of flour" -> "flour"
	s = s.split(/[,;–—]/)[0].trim(); // drop trailing prep notes: "onion, diced"

	// scrub stray numbers/percentages the amount parser didn't own ("93% lean")
	s = s
		.replace(/\d+(?:[./]\d+)?\s*%/g, " ")
		.replace(/\b\d+(?:[./]\d+)?\b/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	return { quantity, unit, searchText: s || line };
}

const INGREDIENT_STOPWORDS = new Set([
	"fresh",
	"chopped",
	"minced",
	"diced",
	"sliced",
	"grated",
	"shredded",
	"crushed",
	"large",
	"small",
	"medium",
	"extra",
	"ground",
	"whole",
	"and",
	"or",
	"the",
	"of",
	"to",
	"taste",
	"optional",
	"for",
	"packed",
	"lean",
]);

// Cheap guard against the food search's fuzzy trigram/substring matching
// returning something unrelated for a short/noisy query. Require at least
// half the meaningful words in our search text to actually appear in the
// candidate's name before trusting it enough to auto-add.
export function isLikelyIngredientMatch(searchText: string, candidateName: string): boolean {
	const words = searchText
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length > 2 && !INGREDIENT_STOPWORDS.has(w));
	if (words.length === 0) return false;

	const name = candidateName.toLowerCase();
	const hits = words.filter((w) => name.includes(w));
	return hits.length > 0 && hits.length / words.length >= 0.5;
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
