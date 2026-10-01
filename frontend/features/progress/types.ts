// Shapes returned by the /workouts/progress/* and /workouts/catalog/:id/history endpoints.

export type ProgressFilter = "week" | "month" | "year" | "all";

export interface LiftChange {
	catalog_id: number;
	name: string;
	muscle_group: string;
	first_value: number;
	last_value: number;
	first_date: string;
	last_date: string;
	percent_change: number;
}

export interface LoggedLift {
	catalog_id: number;
	name: string;
	muscle_group: string;
	session_count: number;
	last_date: string;
}

// One point per workout: that day's best working set (picked by e1RM).
export interface LiftHistoryPoint {
	date: string;
	weight: number;
	reps: number;
	reps_in_reserve: number;
	e1rm: number;
}

export interface LiftHistory {
	catalog_id: number;
	name: string | null;
	muscle_group: string | null;
	data: LiftHistoryPoint[];
}

export interface MuscleGroupVolume {
	muscle_group: string;
	sets: number;
	reps: number;
	percent_of_sets: number;
}

export interface VolumeByMuscleGroup {
	total_sets: number;
	total_reps: number;
	breakdown: MuscleGroupVolume[];
}
