import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { log } from "@/utils/log";
import { getRecipes } from "../api";
import type { RecipeSummary } from "../types";

// The "My recipes" screen's list. Refetches whenever the screen comes back into view,
// so a recipe saved in the editor shows up straight away.
export function useRecipeList() {
	const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState(false);

	const fetchRecipes = useCallback(async () => {
		try {
			setError(false);
			setRecipes(await getRecipes());
		} catch (e) {
			log.error("Recipes fetch error:", e);
			setError(true);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			fetchRecipes();
		}, [fetchRecipes]),
	);

	const refresh = () => {
		setRefreshing(true);
		fetchRecipes();
	};

	return { recipes, loading, refreshing, error, refetch: fetchRecipes, refresh };
}
