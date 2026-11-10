import { useEffect, useState } from "react";
import { log } from "@/utils/log";
import { getCatalog } from "../api";
import type { CatalogExercise } from "../types";

//The whole catalog, fetched the first time the picker opens and kept after that (it's a few hundred rows at most,
//so searching/filtering locally is instant and doesn't hit the server per keystroke)
export function useCatalog(enabled: boolean) {
	const [exercises, setExercises] = useState<CatalogExercise[] | null>(null);
	const [error, setError] = useState(false);
	const [attempt, setAttempt] = useState(0); //bumped by retry() so the effect runs again

	useEffect(() => {
		if (!enabled || exercises) return;

		let cancelled = false;
		getCatalog()
			.then((found) => {
				if (!cancelled) setExercises(found);
			})
			.catch((err) => {
				log.error("Couldn't load exercise catalog", err);
				if (!cancelled) setError(true);
			});

		return () => {
			cancelled = true;
		};
	}, [enabled, exercises, attempt]);

	const retry = () => {
		setError(false);
		setAttempt((a) => a + 1);
	};

	//a newly created exercise goes straight into the list, so it shows up next time without a refetch
	const add = (exercise: CatalogExercise) => setExercises((prev) => [...(prev ?? []), exercise].sort((a, b) => a.name.localeCompare(b.name)));

	return { exercises, error, retry, add };
}
