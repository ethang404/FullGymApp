import type { MuscleGroup } from "./constants";

export type SetType = "warmup" | "working";

export interface WorkoutSet {
	set_id?: number; // undefined/null if not in database
	tempId?: string; // only here if set_id is missing (new set)
	order_number: number;
	set_type: SetType;
	notes: string;
	reps: number | null; // null = not entered yet
	weight: number | null;
	reps_in_reserve: number | null;
}

export interface WorkoutExercise {
	exercise_id?: number; // undefined/null if not in database
	tempId?: string; // only here if exercise_id is missing (new exercise)
	catalog_id?: number;
	exercise_name: string;
	notes: string;
	order_number: number;
	sets: WorkoutSet[];
}

// A full workout: GET /workouts/:id, and what POST/PUT send
export interface WorkoutData {
	workout_name: string;
	workout_date: string;
	notes: string;
	created_at: string;
	finished_at: string | null;
	exercises: WorkoutExercise[];
}

// One row of GET /workouts (the list)
export interface WorkoutSummary {
	id: string;
	name: string;
	date: string;
	duration_minutes?: number;
	total_volume_kg?: number;
	notes?: string;
}

//edit = your own saved workout, new = blank
export type WorkoutMode = "new" | "edit";

//an exercise you can add to a workout (GET/POST /workouts/catalog)
export interface CatalogExercise {
	catalog_id: number;
	name: string;
	muscle_group: MuscleGroup;
}

//a set from the last time you did an exercise (GET /workouts/exercise-stats)
export interface PreviousSet {
	set_type: SetType;
	weight: number | null;
	reps: number | null;
	reps_in_reserve: number | null;
	order_number: number;
}

export interface ExerciseStats {
	best_weight: number | null;
	previous_sets: PreviousSet[];
}
