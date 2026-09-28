import { useCallback, useEffect, useRef, useState } from "react";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import type { UserSearchResult } from "@/types/friends";

// Debounced user search against /friends/search?query= — same debounce + stale-response
// guard shape as useFoodSearch.
export function useFriendSearch(debounceMs = 300) {
	const [query, setQueryState] = useState("");
	const [results, setResults] = useState<UserSearchResult[]>([]);
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

		let cancelled = false;

		const timeoutId = setTimeout(async () => {
			try {
				const res = await instance.get("/friends/search", { params: { query: trimmed } });
				if (!cancelled) setResults(res.data.results ?? []);
			} catch (e) {
				log.error("Friend search error:", e);
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
