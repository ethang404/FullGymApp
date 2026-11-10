import type { OcrResult } from "expo-ocr-kit";

/**
 * Turns raw expo-ocr-kit output into structured nutrition data.
 *
 * Nutrition-label OCR is inherently noisy: letters get swapped ("Calciurn" for
 * "Calcium", "Vitarnin" for "Vitamin"), digits get read as letters ("O" for "0"),
 * and — because the label is a two-column grid — a value can land in a completely
 * different OCR "block" than its label ("Calories" and "140" show up as separate
 * blocks with "Amount per serving" in between).
 *
 * Strategy:
 *  1. Flatten every block into individual lines (blocks often bundle several
 *     printed lines together, separated by "\n").
 *  2. For each line, pull out any "<number><unit>" token (mg/g/mcg/kcal), then
 *     fuzzy-match whatever text is left against a dictionary of canonical
 *     nutrient names. Fuzzy matching (Levenshtein distance) absorbs most OCR
 *     typos without needing to special-case every misread.
 *  3. Calories, serving size, allergens, and the ingredient list each get their
 *     own small heuristic because they don't fit the "label + amount" line shape.
 *
 * This is intentionally NOT trying to be perfect — some tokens really are
 * unrecoverable (see "Vitarnin D Ormcg" in the example data, which has no
 * digit in it at all after OCR mangled it). The output is meant to PRE-FILL an
 * editable form, not to be trusted and submitted blind. Ingredients/allergens
 * in particular are returned as raw text for manual review rather than parsed
 * into structured data — guessing wrong on an allergen is a safety issue, not
 * just a UX nit, and the ingredient block's line order is often scrambled by
 * the scan itself (see the sample: "GREDIENTS:..." ends up as the LAST line).
 */

type MacroField = "calories" | "protein" | "carbs" | "fats";

type Target = { kind: "macro"; field: Exclude<MacroField, "calories"> } | { kind: "micro"; nutrient_name: string };

export interface ParsedNutritionLabel {
	calories?: number;
	macros: Partial<Record<Exclude<MacroField, "calories">, number>>;
	micronutrients: Record<string, number>; // keyed by nutrient_name, e.g. "saturated_fat"
	// weight_g is null when the label only states a volume (e.g. "1 Tbsp
	// (15mL)") with no gram weight anywhere - volume_ml carries that instead
	// so the caller can estimate a gram weight rather than treating it as a
	// literal 0.
	servingSize?: { qty: string; name: string; weight_g: number | null; volume_ml?: number };
	servingsPerContainer?: number;
	allergensRawText?: string;
	ingredientsRawText?: string;
}

/* ---------------------------------------------------------------------- */
/* Levenshtein distance — small and dependency-free                       */
/* ---------------------------------------------------------------------- */

function levenshtein(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	if (m === 0) return n;
	if (n === 0) return m;

	let prev = Array.from({ length: n + 1 }, (_, j) => j);
	let curr = new Array(n + 1).fill(0);

	for (let i = 1; i <= m; i++) {
		curr[0] = i;
		for (let j = 1; j <= n; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
		}
		[prev, curr] = [curr, prev];
	}
	return prev[n];
}

function fuzzyRatio(a: string, b: string): number {
	const maxLen = Math.max(a.length, b.length);
	return maxLen === 0 ? 0 : levenshtein(a, b) / maxLen;
}

/* ---------------------------------------------------------------------- */
/* Canonical nutrient dictionary                                          */
/* ---------------------------------------------------------------------- */

const NUTRIENT_DICTIONARY: { phrase: string; target: Target }[] = [
	// Macros
	{ phrase: "protein", target: { kind: "macro", field: "protein" } },
	{ phrase: "total carbohydrate", target: { kind: "macro", field: "carbs" } },
	{ phrase: "carbohydrate", target: { kind: "macro", field: "carbs" } },
	{ phrase: "total fat", target: { kind: "macro", field: "fats" } },

	// Carb / fat breakdown
	{ phrase: "dietary fiber", target: { kind: "micro", nutrient_name: "fiber" } },
	{ phrase: "total sugars", target: { kind: "micro", nutrient_name: "sugar" } },
	{ phrase: "added sugars", target: { kind: "micro", nutrient_name: "added_sugar" } },
	{ phrase: "saturated fat", target: { kind: "micro", nutrient_name: "saturated_fat" } },
	{ phrase: "trans fat", target: { kind: "micro", nutrient_name: "trans_fat" } },
	{ phrase: "polyunsaturated fat", target: { kind: "micro", nutrient_name: "polyunsaturated_fat" } },
	{ phrase: "monounsaturated fat", target: { kind: "micro", nutrient_name: "monounsaturated_fat" } },

	// Minerals
	{ phrase: "sodium", target: { kind: "micro", nutrient_name: "sodium" } },
	{ phrase: "cholesterol", target: { kind: "micro", nutrient_name: "cholesterol" } },
	{ phrase: "calcium", target: { kind: "micro", nutrient_name: "calcium" } },
	{ phrase: "iron", target: { kind: "micro", nutrient_name: "iron" } },
	{ phrase: "potassium", target: { kind: "micro", nutrient_name: "potassium" } },
	{ phrase: "magnesium", target: { kind: "micro", nutrient_name: "magnesium" } },
	{ phrase: "phosphorus", target: { kind: "micro", nutrient_name: "phosphorus" } },
	{ phrase: "zinc", target: { kind: "micro", nutrient_name: "zinc" } },

	// Vitamins
	{ phrase: "vitamin a", target: { kind: "micro", nutrient_name: "vitamin_a" } },
	{ phrase: "vitamin c", target: { kind: "micro", nutrient_name: "vitamin_c" } },
	{ phrase: "vitamin d", target: { kind: "micro", nutrient_name: "vitamin_d" } },
	{ phrase: "vitamin e", target: { kind: "micro", nutrient_name: "vitamin_e" } },
	{ phrase: "vitamin k", target: { kind: "micro", nutrient_name: "vitamin_k" } },
	{ phrase: "vitamin b6", target: { kind: "micro", nutrient_name: "vitamin_b6" } },
	{ phrase: "vitamin b12", target: { kind: "micro", nutrient_name: "vitamin_b12" } },
	{ phrase: "folate", target: { kind: "micro", nutrient_name: "folate" } },
	{ phrase: "folic acid", target: { kind: "micro", nutrient_name: "folate" } },
	{ phrase: "thiamin", target: { kind: "micro", nutrient_name: "thiamin" } },
	{ phrase: "thiamine", target: { kind: "micro", nutrient_name: "thiamin" } },
	{ phrase: "riboflavin", target: { kind: "micro", nutrient_name: "riboflavin" } },
	{ phrase: "niacin", target: { kind: "micro", nutrient_name: "niacin" } },
];

const FILLER_WORDS = ["includes", "less than", "less", "about", "amount"];

// Built fresh each time it's used (see notes below) so we never depend on a
// shared regex object's `lastIndex` state.
const AMOUNT_UNIT_SOURCE = String.raw`([\d]+(?:\.[\d]+)?)\s*(mcg|µg|kcal|mg|g)\b`;

function cleanLabelText(line: string): string {
	let cleaned = line.replace(new RegExp(AMOUNT_UNIT_SOURCE, "gi"), " ");
	cleaned = cleaned.replace(/[\d.]+\s*%/g, " "); // drop %DV tokens
	for (const w of FILLER_WORDS) {
		cleaned = cleaned.replace(new RegExp(`\\b${w}\\b`, "gi"), " ");
	}
	return cleaned
		.replace(/[^a-zA-Z ]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
}

function matchNutrient(label: string): Target | null {
	if (!label) return null;
	let best: { target: Target; ratio: number } | null = null;
	for (const entry of NUTRIENT_DICTIONARY) {
		const ratio = fuzzyRatio(label, entry.phrase);
		if (!best || ratio < best.ratio) best = { target: entry.target, ratio };
	}
	// Allow ~1/3 character mismatch — enough to absorb "Calciurn" → "calcium",
	// "Vitarnin" → "vitamin", without matching totally unrelated words.
	return best && best.ratio <= 0.34 ? best.target : null;
}

/* ---------------------------------------------------------------------- */
/* Main entry point                                                        */
/* ---------------------------------------------------------------------- */

export function parseNutritionLabel(ocr: OcrResult): ParsedNutritionLabel {
	const result: ParsedNutritionLabel = { macros: {}, micronutrients: {} };

	// Fixes the common "0" → "O" misread right before a unit ("0%" read as "O%").
	// Deliberately narrow (O must be immediately adjacent to the unit) so it
	// doesn't touch unrelated text like a zip code ("O7906").
	const normalize = (s: string) => s.replace(/\bO(mcg|mg|g|kcal|%)\b/gi, "0$1");

	const blockTexts = ocr.blocks.map((b) => normalize(b.text));

	const lines: string[] = [];
	for (const text of blockTexts) {
		for (const raw of text.split("\n")) {
			const t = raw.trim();
			if (t) lines.push(t);
		}
	}

	// ---- Nutrient amounts, line by line ----
	for (const line of lines) {
		const amountMatch = line.match(new RegExp(AMOUNT_UNIT_SOURCE, "i"));
		if (!amountMatch) continue;

		const amount = Number(amountMatch[1]);
		if (Number.isNaN(amount)) continue;

		const target = matchNutrient(cleanLabelText(line));
		if (!target) continue;

		if (target.kind === "macro") {
			result.macros[target.field] = amount;
		} else {
			result.micronutrients[target.nutrient_name] = amount;
		}
	}

	// ---- Calories ----
	// Most labels put "Calories" and its number on the same line, occasionally
	// right next to an old-style "Calories from Fat <n>" on that same line —
	// the negative lookahead makes sure we grab the FIRST count (total calories),
	// not the from-fat one. Some scans still split "Calories" and its number
	// across separate OCR blocks (e.g. "Calories" / "Amount per serving" / "140"),
	// which is handled as a fallback below.
	const CALORIE_SAME_LINE_RE = /calories(?!\s*from)\D{0,12}?(\d{1,4})/i;

	let caloriesFound = false;
	for (const line of lines) {
		const sameLineMatch = line.match(CALORIE_SAME_LINE_RE);
		if (sameLineMatch) {
			result.calories = Number(sameLineMatch[1]);
			caloriesFound = true;
			break;
		}
	}

	if (!caloriesFound) {
		const isBareCaloriesLabel = (line: string) => {
			const alpha = line.replace(/[^a-zA-Z]/g, "").toLowerCase();
			// comparing letters-only means a line like "caloriesfromfat" naturally
			// fails this check (too far from "calories") without a separate exclusion
			return alpha.length > 0 && fuzzyRatio(alpha, "calories") <= 0.3;
		};
		const caloriesLineIndex = lines.findIndex(isBareCaloriesLabel);
		if (caloriesLineIndex !== -1) {
			// Deliberately unbounded: OCR block order does NOT reliably keep the
			// value near the label (in practice it can end up a dozen+ lines away,
			// after several other nutrient rows). A bare 1-4 digit line with nothing
			// else on it is otherwise rare on a nutrition label, so it's safe to
			// keep looking rather than cap the search at an arbitrary window.
			for (let i = caloriesLineIndex + 1; i < lines.length; i++) {
				const bare = lines[i].match(/^\d{1,4}$/);
				if (bare) {
					result.calories = Number(bare[0]);
					break;
				}
			}
		}
	}

	// ---- Serving size ----
	const fullText = normalize(ocr.text);
	const servingMatch = fullText.match(/serving\s*size\s*[:\-]?\s*([^\n]+)/i);
	if (servingMatch) {
		const raw = servingMatch[1].trim();
		const weightMatch = raw.match(/\(?([\d.]+)\s*g\)?/i);
		// Many liquid/oil labels state only a volume ("1 Tbsp (15mL)"), no
		// gram weight at all - checked only when no gram match was found, so
		// a label like "1 tbsp (14g)" still takes the gram value as-is.
		const volumeMatch = !weightMatch ? raw.match(/\(?([\d.]+)\s*ml\)?/i) : null;
		const withoutParens = raw.replace(/\([^)]*\)/, "").trim();
		const qtyNameMatch = withoutParens.match(/^([\d.]+)\s*(.+)$/);
		result.servingSize = {
			qty: qtyNameMatch?.[1] ?? "1",
			name: (qtyNameMatch?.[2] ?? withoutParens).trim(),
			weight_g: weightMatch ? Number(weightMatch[1]) : null,
			...(volumeMatch ? { volume_ml: Number(volumeMatch[1]) } : {}),
		};
	}

	const perContainerMatch = fullText.match(/([\d.]+)\s*servings?\s*per\s*container/i);
	if (perContainerMatch) {
		result.servingsPerContainer = Number(perContainerMatch[1]);
	}

	// ---- Allergens & ingredients: raw text only, for manual review ----
	// A block usually covers a full printed chunk (e.g. "CONTAINS," plus the
	// allergen list on the next line), so grabbing the whole matching block is
	// more reliable here than trying to stitch flattened lines back together.
	const allergensBlock = blockTexts.find((t) => /^contains[:,]?/im.test(t));
	if (allergensBlock) {
		result.allergensRawText = allergensBlock.replace(/^contains[:,]?\s*/i, "").trim();
	}

	const ingredientsBlock = blockTexts.find((t) => /gredients?\s*:/i.test(t));
	if (ingredientsBlock) {
		result.ingredientsRawText = ingredientsBlock;
	}

	return result;
}
