export type SetType = "warmup" | "working";

export interface WorkoutSet {
	set_id?: number; // undefined/null if not in database
	tempId?: string; // only here if set_id is missing (new set)
	order_number: number;
	set_type: SetType;
	notes: string;
	reps: number;
	weight: number;
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
	finished_at: string | null;
	exercises: WorkoutExercise[];
}
