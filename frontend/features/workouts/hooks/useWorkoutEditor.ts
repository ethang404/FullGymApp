import { useState, type Dispatch, type SetStateAction } from "react";
import { reorderItems, type ReorderableListReorderEvent } from "react-native-reorderable-list";
import { randomUUID } from "expo-crypto";
import { log } from "@/utils/log";
import { toast } from "@/utils/toast";
import { haptics } from "@/utils/haptics";
import { createWorkout, updateWorkout } from "../api";
import type { CatalogExercise, WorkoutData, WorkoutSet } from "../types";
import { exerciseKey, makeEmptySet, renumber, setKey } from "../utils/workoutEditor";

// Every change the workout editor can make, plus saving.
// `workout`/`setWorkout` come from useWorkout so the loaded workout and the edits share one state.
// workoutId is only set when editing a saved workout.
export function useWorkoutEditor(workout: WorkoutData, setWorkout: Dispatch<SetStateAction<WorkoutData>>, workoutId?: number) {
	const [saving, setSaving] = useState(false);
	const isEditing = workoutId != null; //saved workout: PUT over it. Otherwise (new) POST a new one

	const setName = (workout_name: string) => setWorkout((w) => ({ ...w, workout_name }));

	//change one set in one exercise, leave everything else alone
	const updateSet = (exKey: string, sKey: string, patch: Partial<WorkoutSet>) =>
		setWorkout((w) => ({
			...w,
			exercises: w.exercises.map((e) => (exerciseKey(e) !== exKey ? e : { ...e, sets: e.sets.map((s) => (setKey(s) === sKey ? { ...s, ...patch } : s)) })),
		}));

	const addSet = (exKey: string) =>
		setWorkout((w) => ({
			...w,
			exercises: w.exercises.map((e) => (exerciseKey(e) !== exKey ? e : { ...e, sets: [...e.sets, makeEmptySet(e.sets.length + 1)] })),
		}));

	//new exercises go on the end with one empty working set ready to fill in
	const addExercise = (picked: CatalogExercise) => {
		haptics.tap();
		setWorkout((w) => ({
			...w,
			exercises: [
				...w.exercises,
				{
					tempId: randomUUID(),
					catalog_id: picked.catalog_id,
					exercise_name: picked.name,
					notes: "",
					order_number: w.exercises.length + 1,
					sets: [makeEmptySet(1)],
				},
			],
		}));
	};

	//renumber closes the gap so the remaining sets stay 1..n
	const deleteSet = (exKey: string, sKey: string) =>
		setWorkout((w) => ({
			...w,
			exercises: w.exercises.map((e) => (exerciseKey(e) !== exKey ? e : { ...e, sets: renumber(e.sets.filter((s) => setKey(s) !== sKey)) })),
		}));

	const removeExercise = (exKey: string) => setWorkout((w) => ({ ...w, exercises: renumber(w.exercises.filter((e) => exerciseKey(e) !== exKey)) }));

	//drag-and-drop: move the item, then renumber so order_number always matches what's on screen
	const reorderExercises = ({ from, to }: ReorderableListReorderEvent) => setWorkout((w) => ({ ...w, exercises: renumber(reorderItems(w.exercises, from, to)) }));

	const reorderSets = (exKey: string, { from, to }: ReorderableListReorderEvent) =>
		setWorkout((w) => ({
			...w,
			exercises: w.exercises.map((e) => (exerciseKey(e) !== exKey ? e : { ...e, sets: renumber(reorderItems(e.sets, from, to)) })),
		}));

	// Saves the workout. Returns "updated" for a saved workout, "created" for a new one,
	// or null if nothing was saved (already saving, invalid, or the request failed).
	const save = async (): Promise<"updated" | "created" | null> => {
		if (saving) return null;

		//the backend rejects these anyway; catching them here gives a useful message instead of a failed request
		if (!workout.workout_name.trim()) {
			toast.error("Give your workout a name.");
			return null;
		}
		if (workout.exercises.length === 0) {
			toast.error("Add at least one exercise.");
			return null;
		}

		//finishing a new workout stamps it finished now. Finished workouts are what "prev"/"best" read from,
		//so an unfinished one would never show up there. Editing keeps the original time.
		const payload = { ...workout, finished_at: workout.finished_at ?? new Date().toISOString() };

		setSaving(true);
		try {
			if (isEditing) await updateWorkout(workoutId, payload);
			else await createWorkout(payload);
			haptics.success();
			// saving stays true on success: the screen is about to close
			return isEditing ? "updated" : "created";
		} catch (err) {
			log.error("Couldn't save workout", err);
			toast.error("Workout not saved. Check your connection and try again.");
			setSaving(false);
			return null;
		}
	};

	return {
		isEditing,
		saving,
		save,
		setName,
		updateSet,
		addSet,
		addExercise,
		deleteSet,
		removeExercise,
		reorderExercises,
		reorderSets,
	};
}
