import type { ContentVisibility } from "./visibility";

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

export interface WorkoutData {
	workout_name: string;
	workout_date: string;
	notes: string;
	created_at: string;
	finished_at: string | null;
	exercises: WorkoutExercise[];
	visibility: ContentVisibility;
}

//view = read only, edit = your own saved workout, copy = someone's workout as a starting point, new = blank
export type WorkoutMode = "new" | "edit" | "copy" | "view";

//same values as the exercise_catalog.muscle_group enum on the backend
export const MUSCLE_GROUPS = ["chest", "back", "shoulders", "biceps", "triceps", "legs", "glutes", "core", "full_body", "cardio"] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
	chest: "Chest",
	back: "Back",
	shoulders: "Shoulders",
	biceps: "Biceps",
	triceps: "Triceps",
	legs: "Legs",
	glutes: "Glutes",
	core: "Core",
	full_body: "Full body",
	cardio: "Cardio",
};

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
