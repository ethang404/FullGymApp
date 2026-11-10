import { useCallback, useEffect, useRef, useState } from "react";
import { log } from "@/utils/log";
import { searchFoods } from "../api";
import type { FoodSearchResult } from "../types";

// Debounced food-database search against /nutrition/foods?q=.
// Shared by LogFoodModal (Foods tab) and AddIngredientModal so the debounce +
// stale-response guard live in one place.
export function useFoodSearch(debounceMs = 300) {
	const [query, setQueryState] = useState("");
	const [results, setResults] = useState<FoodSearchResult[]>([]);
	const [loading, setLoading] = useState(false);
	const queryRef = useRef("");

	// Loading/clearing is driven from the setter (the event) rather than the effect, so a
	// keystroke updates everything in one render. Stable identity - callers list it as a dep.
	const setQuery = useCallback((next: string) => {
		// An unchanged query won't re-run the effect, so it must not flip loading on either.
		if (next === queryRef.current) return;
		queryRef.current = next;
		setQueryState(next);
		if (next.trim()) {
			setLoading(true);
		} else {
			setResults([]);
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const trimmed = query.trim();
		if (!trimmed) return;

		// `cancelled` covers both the debounce (a new keystroke clears the pending
		// timer) and a slow response landing after the query already moved on.
		let cancelled = false;

		const timeoutId = setTimeout(async () => {
			try {
				const foods = await searchFoods(trimmed);
				if (!cancelled) setResults(foods);
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
