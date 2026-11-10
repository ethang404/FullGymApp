import { useCallback, useEffect, useState } from "react";
import { log } from "@/utils/log";
import { getRecentLogged } from "../api";
import type { RecentLoggedItem } from "../types";

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
			setItems(await getRecentLogged());
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
