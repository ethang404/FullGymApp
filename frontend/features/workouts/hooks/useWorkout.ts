import { useEffect, useState } from "react";
import { log } from "@/utils/log";
import { getWorkout } from "../api";
import type { WorkoutData, WorkoutMode } from "../types";
import { makeEmptyWorkout } from "../utils/workoutEditor";

// Loads the workout the editor opens on. "new" mode starts blank and fetches nothing.
export function useWorkout(workout_id: string | undefined, mode: WorkoutMode) {
	const shouldFetch = mode !== "new" && !!workout_id; // "new" mode: nothing to fetch (new workouts open with workout_id "new")

	const [workout, setWorkout] = useState<WorkoutData>(makeEmptyWorkout); //the function itself: React calls it once, on the first render
	const [loading, setLoading] = useState(shouldFetch);
	//the load failed. The screen shows an error + retry instead of the editor, so an empty placeholder workout
	//can never be saved over the real one (editing deletes any exercises/sets missing from what we send)
	const [error, setError] = useState(false);
	const [attempt, setAttempt] = useState(0); //bumped by retry() so the effect runs again

	useEffect(() => {
		if (!shouldFetch || !workout_id) return;

		let cancelled = false;

		const load = async () => {
			try {
				const found = await getWorkout(workout_id);
				if (!cancelled) setWorkout(found);
			} catch (err) {
				log.error("Couldn't get workout", err);
				if (!cancelled) setError(true);
			} finally {
				if (!cancelled) setLoading(false);
			}
		};

		load();
		return () => {
			cancelled = true; // screen closed before the request finished: ignore the response
		};
	}, [workout_id, mode, shouldFetch, attempt]);

	const retry = () => {
		setError(false);
		setLoading(true);
		setAttempt((a) => a + 1);
	};

	return { workout, setWorkout, loading, error, retry };
}
