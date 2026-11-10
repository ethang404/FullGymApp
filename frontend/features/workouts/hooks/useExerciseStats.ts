import { useEffect, useState } from "react";
import { log } from "@/utils/log";
import { getExerciseStats } from "../api";
import type { ExerciseStats } from "../types";

//Best weight + last session's sets for each exercise, keyed by catalog_id.
//Only fetches ids it doesn't have yet: everything on load, then just the new one when an exercise is added.
//Reordering/adding sets/typing never refetches since the ids on screen don't change.
export function useExerciseStats(catalogIds: number[], excludeWorkoutId?: number) {
	const [stats, setStats] = useState<Record<number, ExerciseStats>>({});
	//failed requests so far. Bumping it changes a dependency, which is what makes the effect run again -
	//otherwise a failure leaves missingKey the same and nothing would ever retry
	const [failures, setFailures] = useState(0);

	//a string so the effect only re-runs when the actual missing ids change (a new array every render would re-run it every time)
	const missingKey = catalogIds.filter((id) => !(id in stats)).join(",");

	useEffect(() => {
		if (!missingKey) return;

		let cancelled = false;
		let retryTimer: ReturnType<typeof setTimeout> | undefined;

		getExerciseStats(missingKey.split(",").map(Number), excludeWorkoutId)
			.then((found) => {
				if (!cancelled) setStats((prev) => ({ ...prev, ...found }));
			})
			.catch((err) => {
				log.error("Couldn't get exercise stats", err);
				//try again in a few seconds, up to 3 times (prev/best are nice to have, not worth hammering the server for)
				if (!cancelled && failures < 3) retryTimer = setTimeout(() => setFailures((f) => f + 1), 3000);
			});

		return () => {
			cancelled = true;
			clearTimeout(retryTimer); //left the screen (or the ids changed): drop any pending retry
		};
	}, [missingKey, excludeWorkoutId, failures]);

	return stats;
}
