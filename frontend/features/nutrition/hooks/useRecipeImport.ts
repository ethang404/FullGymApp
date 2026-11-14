import { useState } from "react";
import { log } from "@/utils/log";
import { toast } from "@/utils/toast";
import { getFullFood, searchFoods } from "../api";
import type { FoodSearchResult, ImportedRecipe, ParsedIngredientLine, RecipeIngredient, ServingSize } from "../types";
import { isLikelyIngredientMatch, parseIngredientLine } from "../utils/ingredientParsing";
import { calcMacrosFromPer100g } from "../utils/nutrients";
import { resolveServingWeightG } from "../utils/servingUnits";

// quantity/unit from the recipe text if we can resolve it against this
// food's servings, otherwise the food's own default serving (still added -
// it's an editable RecipeFoodCard, so a wrong guess is a one-tap fix).
async function buildIngredientFromMatch(parsed: ParsedIngredientLine, food: FoodSearchResult): Promise<RecipeIngredient> {
	let quantity = parsed.quantity ?? 1;
	let serving: ServingSize;

	const weightG = parsed.unit ? resolveServingWeightG(parsed.unit, food.serving_sizes, food.name, food.brand) : null;
	if (weightG != null) {
		serving = { label: parsed.unit as string, weight_g: weightG };
	} else {
		quantity = food.default_serving.default_quantity ?? quantity;
		serving = { label: food.default_serving.label, weight_g: food.default_serving.weight_g };
	}

	// Search results only carry the 4 macro nutrients - fetch the full food
	// for accurate label math (same reason RecipeFoodCard does this on add).
	const fullFood = await getFullFood(food.id);
	const macros = calcMacrosFromPer100g(quantity, serving.weight_g, fullFood.nutrients_per_100g);

	return {
		id: `${food.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, //need temporary unique id for display
		food: fullFood,
		quantity,
		baseQuantity: quantity,
		serving,
		cals: macros.cals ?? 0,
		protein: macros.protein ?? 0,
		carbs: macros.carbs ?? 0,
		fat: macros.fat ?? 0,
	};
}

// Turn one imported ingredient line into a food-search hit, iff we're
// confident enough to add it without the user looking at it first.
// Returns null (never throws) so Promise.allSettled in runAutoMatch treats
// "no match" and "search failed" the same way.
async function autoMatchIngredient(line: string): Promise<RecipeIngredient | null> {
	const parsed = parseIngredientLine(line);
	if (!parsed.searchText) return null;

	let results: FoodSearchResult[];
	try {
		results = await searchFoods(parsed.searchText);
	} catch (e) {
		log.error(`Auto-match search failed for "${line}":`, e);
		return null;
	}
	if (results.length === 0) return null;

	const top = results[0];
	if (!isLikelyIngredientMatch(parsed.searchText, top.name)) return null;

	try {
		return await buildIngredientFromMatch(parsed, top);
	} catch (e) {
		log.error(`Auto-match failed to build ingredient for "${line}":`, e);
		return null;
	}
}

// A recipe imported from a link: the raw ingredient lines still waiting to be matched
// to foods, the imported steps, and the auto-matcher that adds confident matches.
// `applyDetails` takes the imported name/servings; `addIngredients` takes matched ingredients.
export function useRecipeImport({
	applyDetails,
	addIngredients,
}: {
	applyDetails: (imported: ImportedRecipe) => void;
	addIngredients: (ingredients: RecipeIngredient[]) => void;
}) {
	const [importedIngredients, setImportedIngredients] = useState<string[]>([]);
	const [importedInstructions, setImportedInstructions] = useState<string[]>([]);
	const [importSourceUrl, setImportSourceUrl] = useState<string | null>(null);
	const [autoMatching, setAutoMatching] = useState(false);

	// Runs the auto-matcher over `lines` in parallel and merges whatever hits
	// straight into the recipe's ingredient list. Uses functional state updates
	// throughout so a manual match/dismiss the user makes while this is in
	// flight isn't clobbered when it resolves.
	async function runAutoMatch(ingredientLines: string[]) {
		if (ingredientLines.length === 0) return;
		setAutoMatching(true);

		const settled = await Promise.allSettled(ingredientLines.map((line) => autoMatchIngredient(line)));

		const createdIngredients: RecipeIngredient[] = [];
		const matchedLines = new Set<string>();
		settled.forEach((result, i) => {
			if (result.status === "fulfilled" && result.value) {
				createdIngredients.push(result.value);
				matchedLines.add(ingredientLines[i]);
			}
		});

		if (createdIngredients.length > 0) {
			addIngredients(createdIngredients);
			setImportedIngredients((prev) => prev.filter((line) => !matchedLines.has(line))); //keep only lines not found/matched
		}

		setAutoMatching(false);
		toast[createdIngredients.length ? "success" : "error"](
			createdIngredients.length
				? `Auto-matched ${createdIngredients.length}/${ingredientLines.length} ingredient${ingredientLines.length === 1 ? "" : "s"}. Review the rest below.`
				: "Couldn't auto-match any ingredients — tap one below to search manually.",
		);
	}

	function handleImported(imported: ImportedRecipe) {
		applyDetails(imported);
		const lines = imported.ingredients ?? [];
		setImportedIngredients(lines);
		setImportedInstructions(imported.instructions ?? []);
		setImportSourceUrl(imported.source_url ?? null);

		toast.success(lines.length ? `Imported ${lines.length} ingredient${lines.length === 1 ? "" : "s"} — matching against your food list…` : "Recipe imported.");

		// Best-effort: try to resolve each line to a food automatically. Whatever
		// doesn't confidently match stays in the review list for manual search.
		void runAutoMatch(lines);
	}

	function dismissImportedIngredient(text: string) {
		setImportedIngredients((prev) => prev.filter((t) => t !== text));
	}

	return {
		importedIngredients,
		importedInstructions,
		importSourceUrl,
		autoMatching,
		handleImported,
		runAutoMatch,
		dismissImportedIngredient,
	};
}
