import { useEffect, useMemo, useState } from "react";
import { log } from "@/utils/log";
import { toast } from "@/utils/toast";
import { createRecipe, getRecipe, updateRecipe } from "../api";
import type { ImportedRecipe, RecipeIngredient, SavedRecipeIngredient } from "../types";
import { calcNutrientsFromPer100g, calcRecipeTotals } from "../utils/nutrients";
import { resolveServingWeightG } from "../utils/servingUnits";

// A saved ingredient from the API -> the shape the editor works with.
function toEditorIngredient(ing: SavedRecipeIngredient): RecipeIngredient {
	// Resolve unit weight in grams (explicit serving row, fixed mass
	// unit, or derived volume ratio). If truly unresolvable, fall back
	// to 1 (treat quantity as literal grams) rather than silently
	// guessing 100g, and flag it so the user notices.
	const resolved = resolveServingWeightG(ing.unit, ing.serving_sizes ?? [], ing.food_name);
	const unitWeightG = resolved ?? 1;
	if (resolved == null) {
		log.warn(`Could not resolve unit "${ing.unit}" for ingredient "${ing.food_name}" - defaulting to 1g/unit.`);
	}

	// The saved recipe doesn't include each food's default_serving or the per-ingredient
	// macro fields, so those stay unset here - same as before this was typed.
	return {
		id: String(ing.ingredient_id),
		food: {
			id: ing.food_id,
			name: ing.food_name,
			nutrients_per_100g: ing.nutrients_per_100g,
			serving_sizes: ing.serving_sizes ?? [],
		},
		quantity: ing.quantity,
		baseQuantity: ing.quantity,
		serving: {
			label: ing.unit,
			weight_g: unitWeightG,
		},
	} as RecipeIngredient;
}

// The recipe being created or edited: its name, servings, ingredients and totals.
// With a recipeId it loads that recipe first and saves over it; without one it saves a new recipe.
export function useRecipeEditor(recipeId?: string) {
	const [recipeName, setRecipeName] = useState("");
	const [servings, setServings] = useState("1");
	const [baseServings, setBaseServings] = useState("1");
	const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
	const [loading, setLoading] = useState(!!recipeId);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!recipeId) return;
		let cancelled = false;

		(async () => {
			try {
				const recipeData = await getRecipe(recipeId);
				if (cancelled) return;

				setRecipeName(recipeData.name ?? "");
				setServings(String(recipeData.servings ?? 1));
				setBaseServings(String(recipeData.servings ?? 1));
				setIngredients((recipeData.ingredients ?? []).map(toEditorIngredient));
			} catch (e) {
				log.error("Failed to load recipe:", e);
				if (!cancelled) toast.error("Couldn't load this recipe.");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [recipeId]);

	async function save() {
		setSaving(true);
		try {
			const payload = {
				name: recipeName,
				servings: parseFloat(servings) || 1,
				ingredients: ingredients.map((ing) => ({
					food_id: ing.food.id,
					quantity: ing.quantity,
					unit: ing.serving.label,
				})),
			};
			if (recipeId) {
				await updateRecipe(recipeId, payload);
			} else {
				await createRecipe(payload);
			}
			toast.success(recipeId ? "Recipe updated." : "Recipe saved.");
		} catch (e) {
			log.error("Failed to save recipe:", e);
			toast.error("Couldn't save the recipe. Try again.");
		} finally {
			setSaving(false);
		}
	}

	//Dynamically calculate nutrition data based on all data for a recipe
	const totals = useMemo(() => calcRecipeTotals(ingredients), [ingredients]);

	//typing a servings number makes it the new base the scale buttons multiply from
	function changeServings(text: string) {
		setServings(text);
		setBaseServings(text);
	}

	//allow us to scale all ingredients with a button!
	function scaleAllIngredients(factor: number) {
		setIngredients((prev) =>
			prev.map((ing) => {
				const base = ing.baseQuantity ?? ing.quantity;
				const nextQty = base * factor;
				const nutrients = calcNutrientsFromPer100g(nextQty, ing.serving.weight_g, ing.food.nutrients_per_100g);
				return { ...ing, quantity: nextQty, ...nutrients };
			}),
		);

		//also scale serving size
		const baseServingAmount = parseFloat(baseServings) || 1;
		setServings(String(baseServingAmount * factor));
	}

	//name + servings from a recipe imported from a link
	function applyImportedDetails(imported: ImportedRecipe) {
		if (imported.name) setRecipeName(imported.name);
		if (imported.servings && imported.servings > 0) {
			setServings(String(imported.servings));
			setBaseServings(String(imported.servings));
		}
	}

	function addIngredients(added: RecipeIngredient[]) {
		setIngredients((prev) => [...prev, ...added]);
	}

	function changeIngredient(updated: RecipeIngredient) {
		setIngredients((prev) => prev.map((ing) => (ing.id === updated.id ? updated : ing)));
	}

	function removeIngredient(id: string) {
		setIngredients((prev) => prev.filter((ing) => ing.id !== id));
	}

	return {
		loading,
		saving,
		save,
		recipeName,
		setRecipeName,
		servings,
		changeServings,
		ingredients,
		addIngredients,
		changeIngredient,
		removeIngredient,
		scaleAllIngredients,
		applyImportedDetails,
		totals,
	};
}
