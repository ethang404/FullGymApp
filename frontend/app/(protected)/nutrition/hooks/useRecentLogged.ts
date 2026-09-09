import { useCallback, useEffect, useState } from "react";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import type { RecentLoggedItem, RecipeSummary } from "../../types/nutrition";

// GET /nutrition/recent — recently logged distinct foods + recipes, newest first.
// `enabled` gates the fetch so the log sheet only loads it while open.
export function useRecentLogged(enabled: boolean) {
	const [items, setItems] = useState<RecentLoggedItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);

	const refetch = useCallback(async () => {
		setLoading(true);
		setError(false);
		try {
			const res = await instance.get("/nutrition/recent");
			setItems(res.data.recent ?? []);
		} catch (e) {
			log.error("Recent logged fetch error:", e);
			setError(true);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (enabled) refetch();
	}, [enabled, refetch]);

	return { items, loading, error, refetch };
}

// GET /nutrition/recipes — the user's own recipes, fetched once while `enabled`.
export function useRecipes(enabled: boolean) {
	const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);

	const refetch = useCallback(async () => {
		setLoading(true);
		setError(false);
		try {
			const res = await instance.get("/nutrition/recipes");
			setRecipes(res.data.recipes ?? res.data ?? []);
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
