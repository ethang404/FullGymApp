import { useEffect, useState } from "react";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import type { FoodSearchResult } from "../../types/nutrition";

// Debounced food-database search against /nutrition/foods?q=.
// Shared by LogFoodModal (Foods tab) and AddIngredientModal so the debounce +
// stale-response guard live in one place.
export function useFoodSearch(debounceMs = 300) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<FoodSearchResult[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const trimmed = query.trim();
		if (!trimmed) {
			setResults([]);
			setLoading(false);
			return;
		}

		// `cancelled` covers both the debounce (a new keystroke clears the pending
		// timer) and a slow response landing after the query already moved on.
		let cancelled = false;
		setLoading(true);

		const timeoutId = setTimeout(async () => {
			try {
				const res = await instance.get(`/nutrition/foods?q=${encodeURIComponent(trimmed)}`);
				if (!cancelled) setResults(res.data.foods ?? []);
			} catch (e) {
				log.error("Food search error:", e);
				if (!cancelled) setResults([]);
			} finally {
				if (!cancelled) setLoading(false);
			}
		}, debounceMs);

		return () => {
			cancelled = true;
			clearTimeout(timeoutId);
		};
	}, [query, debounceMs]);

	return { query, setQuery, results, loading };
}
