import { useCallback, useEffect, useState } from "react";
import { log } from "@/utils/log";
import { getRecipes } from "../api";
import type { RecipeSummary } from "../types";

// GET /nutrition/recipes — the user's own recipes, fetched once while `enabled`.
// Used by the log food sheet's Recipes tab.
export function useRecipes(enabled: boolean) {
	const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);

	const refetch = useCallback(async () => {
		setLoading(true);
		setError(false);
		try {
			setRecipes(await getRecipes());
		} catch (e) {
			log.error("Recipes fetch error:", e);
			setError(true);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (enabled) refetch();
	}, [enabled, refetch]);

	return { recipes, loading, error, refetch };
}
