// Fixed categorical palette for the 10 exercise_catalog muscle groups (see
// backend/models/exerciseCatalog.js for the canonical ENUM list). Kept
// independent of the active theme's primary/accent colors (unlike
// macroProtein/Carbs/Fat, which are theme-tokenized but only cover 3
// categories) since we need 10 distinct, readable hues that hold up across
// all 8 selectable themes/backgrounds.
export const MUSCLE_GROUP_COLORS: Record<string, string> = {
	chest: "#EF4444",
	back: "#3B82F6",
	shoulders: "#F59E0B",
	biceps: "#8B5CF6",
	triceps: "#EC4899",
	legs: "#10B981",
	glutes: "#14B8A6",
	core: "#F97316",
	full_body: "#6366F1",
	cardio: "#06B6D4",
};

const FALLBACK_COLOR = "#9CA3AF";

export function getMuscleGroupColor(muscleGroup: string): string {
	return MUSCLE_GROUP_COLORS[muscleGroup] ?? FALLBACK_COLOR;
}
