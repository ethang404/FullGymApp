import { useCallback, useEffect, useRef, useState } from "react";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import type { ExploreItem, ExploreScope, ExploreType } from "../../../types/explore";

interface Options {
	type: ExploreType;
	scope: ExploreScope;
	search: string;
}

// Cursor-paginated /explore feed. Resets and refetches from the top whenever
// type/scope change (immediately) or search changes (debounced, same shape as
// useFoodSearch/useFriendSearch); loadMore appends the next page using the
// cursor contract from GET /explore.
export function useExploreFeed({ type, scope, search }: Options) {
	const [items, setItems] = useState<ExploreItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState(false);
	const [hasMore, setHasMore] = useState(false);

	// Cursor lives in a ref, not state - loadMore needs the latest value without
	// making the fetch callback's identity (and therefore the reset effect) depend on it.
	const cursorRef = useRef<string | null>(null);
	// Guards a slow/stale response (filters changed again, or a fast refocus) from
	// clobbering newer state.
	const requestId = useRef(0);

	const runFetch = useCallback(async (params: Options, reset: boolean) => {
		const myRequestId = ++requestId.current;
		if (reset) {
			setLoading(true);
			setError(false);
		} else {
			setLoadingMore(true);
		}

		try {
			const res = await instance.get("/explore", {
				params: {
					type: params.type,
					scope: params.scope,
					search: params.search.trim() || undefined,
					cursor: reset ? undefined : (cursorRef.current ?? undefined),
					limit: 20,
				},
			});
			if (myRequestId !== requestId.current) return; // stale - a newer request already landed or is in flight

			const newItems: ExploreItem[] = res.data.items ?? [];
			setItems((prev) => (reset ? newItems : [...prev, ...newItems]));
			cursorRef.current = res.data.next_cursor ?? null;
			setHasMore(!!res.data.next_cursor);
		} catch (e) {
			if (myRequestId !== requestId.current) return;
			log.error("Explore feed fetch error:", e);
			if (reset) setError(true);
		} finally {
			if (myRequestId !== requestId.current) return;
			setLoading(false);
			setLoadingMore(false);
		}
	}, []);

	useEffect(() => {
		const timeoutId = setTimeout(
			() => {
				cursorRef.current = null;
				runFetch({ type, scope, search }, true);
			},
			search ? 300 : 0,
		);
		return () => clearTimeout(timeoutId);
	}, [type, scope, search, runFetch]);

	const loadMore = useCallback(() => {
		if (loading || loadingMore || !hasMore) return;
		runFetch({ type, scope, search }, false);
	}, [loading, loadingMore, hasMore, type, scope, search, runFetch]);

	const refresh = useCallback(() => {
		cursorRef.current = null;
		return runFetch({ type, scope, search }, true);
	}, [type, scope, search, runFetch]);

	return { items, loading, loadingMore, error, hasMore, loadMore, refresh };
}
