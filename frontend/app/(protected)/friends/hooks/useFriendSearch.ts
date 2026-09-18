import { useEffect, useState } from "react";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import type { UserSearchResult } from "../../types/friends";

// Debounced user search against /friends/search?query= — same debounce + stale-response
// guard shape as useFoodSearch.
export function useFriendSearch(debounceMs = 300) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<UserSearchResult[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const trimmed = query.trim();
		if (!trimmed) {
			setResults([]);
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);

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
