import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { log } from "@/utils/log";
import { toast } from "@/utils/toast";
import { getDiary } from "../api";
import type { DiaryEntry } from "../types";

// One day of the food diary, for the Food tab.
export function useDiary(date: string) {
	const [entries, setEntries] = useState<DiaryEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState(false);

	const fetchEntries = useCallback(
		async (isRefresh = false) => {
			try {
				setEntries(await getDiary(date));
				setError(false);
			} catch (e) {
				log.error("Nutrition fetch error:", e);
				if (isRefresh) toast.error("Couldn't refresh. Pull down to try again.");
				else setError(true);
			} finally {
				setLoading(false);
				setRefreshing(false);
			}
		},
		[date],
	);

	// Refetch every time this tab regains focus (not just on first mount),
	// so coming back from another tab shows fresh data instead of a stale cache.
	useFocusEffect(
		useCallback(() => {
			fetchEntries();
		}, [fetchEntries]),
	);

	// pull to refresh: a failure shows a toast instead of replacing the diary with an error
	const refresh = () => {
		setRefreshing(true);
		fetchEntries(true);
	};

	return { entries, loading, refreshing, error, refetch: fetchEntries, refresh };
}
