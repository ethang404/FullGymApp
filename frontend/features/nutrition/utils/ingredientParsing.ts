import type { ParsedIngredientLine } from "../types";

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

export function parseIngredientLine(line: string): ParsedIngredientLine {
	let s = stripParentheticals(line).replace(/\s+/g, " ").trim();

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
