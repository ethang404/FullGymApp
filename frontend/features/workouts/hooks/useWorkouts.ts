import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { log } from "@/utils/log";
import { toast } from "@/utils/toast";
import { getWorkouts } from "../api";
import type { WorkoutSummary } from "../types";

// The Workouts tab's list of past workouts.
export function useWorkouts() {
	const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState(false);

	const fetchWorkouts = useCallback(async (isRefresh = false) => {
		try {
			setWorkouts(await getWorkouts());
			setError(false);
		} catch (e) {
			log.error("Workouts fetch error:", e);
			if (isRefresh) toast.error("Couldn't refresh. Pull down to try again.");
			else setError(true);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, []);

	// Refetch whenever the tab regains focus, so a workout saved on the editor
	// screen shows up when you come back here.
	useFocusEffect(
		useCallback(() => {
			fetchWorkouts();
		}, [fetchWorkouts]),
	);

	// pull to refresh: a failure shows a toast instead of replacing the list with an error
	const refresh = () => {
		setRefreshing(true);
		fetchWorkouts(true);
	};

	return { workouts, loading, refreshing, error, refetch: fetchWorkouts, refresh };
}
