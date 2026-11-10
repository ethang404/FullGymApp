import { instance } from "@/utils/AxiosInterceptorHandler";
import type { MuscleGroup } from "./constants";
import type { CatalogExercise, ExerciseStats, WorkoutData, WorkoutSummary } from "./types";

// Every workout endpoint the app calls. These only talk to the server and hand
// back the data (or throw) - loading flags, toasts and navigation belong to the caller.

// ---------------- Workouts ----------------

export async function getWorkouts(): Promise<WorkoutSummary[]> {
	const res = await instance.get("/workouts");
	return res.data.workouts ?? [];
}

export async function getWorkout(workoutId: string): Promise<WorkoutData> {
	const res = await instance.get(`/workouts/${workoutId}`);
	return res.data.workout;
}

export async function createWorkout(workout: WorkoutData): Promise<void> {
	await instance.post("/workouts", workout);
}

export async function updateWorkout(workoutId: number, workout: WorkoutData): Promise<void> {
	await instance.put(`/workouts/${workoutId}`, workout);
}

// Best weight + last session's sets per exercise, keyed by catalog_id.
// excludeWorkoutId keeps a workout's own sets out of "prev" while you edit it.
export async function getExerciseStats(catalogIds: number[], excludeWorkoutId?: number): Promise<Record<number, ExerciseStats>> {
	const res = await instance.get("/workouts/exercise-stats", { params: { catalog_ids: catalogIds.join(","), exclude_workout_id: excludeWorkoutId } });
	return res.data.stats;
}

// ---------------- Exercise catalog ----------------

export async function getCatalog(): Promise<CatalogExercise[]> {
	const res = await instance.get("/workouts/catalog");
	return res.data.exercises;
}

export async function createCatalogExercise(exercise: { name: string; muscle_group: MuscleGroup }): Promise<CatalogExercise> {
	const res = await instance.post("/workouts/catalog", exercise);
	return res.data.exercise;
}
