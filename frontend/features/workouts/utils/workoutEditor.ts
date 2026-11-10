import { randomUUID } from "expo-crypto";
import { todayISO } from "@/utils/date";
import type { PreviousSet, WorkoutData, WorkoutExercise, WorkoutSet } from "../types";

// Small pure helpers for the workout editor.

//default state of workout. A function (not a constant) so the date is "today" when the screen opens,
//not whenever the app first loaded this file.
export function makeEmptyWorkout(): WorkoutData {
	return {
		workout_name: "",
		workout_date: todayISO(), //local calendar date ("2026-10-06"). toISOString() is UTC and can already be tomorrow in the evening
		notes: "",
		created_at: new Date().toISOString(), //an exact moment, so UTC is right here
		finished_at: null,
		exercises: [],
	};
}

//a blank working set, numbered `order_number`
export function makeEmptySet(order_number: number): WorkoutSet {
	return { tempId: randomUUID(), order_number, set_type: "working", notes: "", weight: null, reps: null, reps_in_reserve: null };
}

//stable keys: database id if saved, tempId if not
export const exerciseKey = (e: WorkoutExercise) => String(e.exercise_id ?? e.tempId);
export const setKey = (s: WorkoutSet) => String(s.set_id ?? s.tempId);

//array position is the source of truth for order; order_number just mirrors it (1-based, like the backend expects)
export const renumber = <T extends { order_number: number }>(items: T[]) => items.map((item, i) => ({ ...item, order_number: i + 1 }));

//157.5 -> "157.5", null -> "–"
export const formatNumber = (n: number | null | undefined) => (n == null ? "–" : String(n));

//"W" for warmups, working sets numbered 1, 2, 3... (warmups don't count toward the number)
export function setLabels(sets: WorkoutSet[]) {
	let working = 0;
	return sets.map((s) => (s.set_type === "warmup" ? "W" : String(++working)));
}

//Line each set up with the same set from last time: 1st warmup with 1st warmup, 2nd working with 2nd working.
//Matching within a type means adding an extra warmup doesn't shift every working row.
export function pairWithPrevious(sets: WorkoutSet[], previous: PreviousSet[]) {
	const seen: Record<string, number> = {};
	return sets.map((s) => {
		const n = seen[s.set_type] ?? 0;
		seen[s.set_type] = n + 1;
		return previous.filter((p) => p.set_type === s.set_type)[n] ?? null;
	});
}
