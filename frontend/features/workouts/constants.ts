import type { SetType } from "./types";

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

export const SET_TYPE_OPTIONS: { type: SetType; label: string }[] = [
	{ type: "warmup", label: "Warmup" },
	{ type: "working", label: "Working set" },
];
