// Mirror of backend/constants/macroDefaults.js — kept in sync by hand since there
// is no shared package. Used as the fallback whenever a user has not set a goal.

export const GOAL_DEFAULTS = {
	calories: 2400,
	protein: 160,
	carbs: 250,
	fat: 75,
	fiber: 30,
} as const;

export type MacroGoals = { calories: number; protein: number; carbs: number; fat: number; fiber: number };
export type MacroKey = keyof MacroGoals;

export const MACRO_KEYS: MacroKey[] = ["calories", "protein", "carbs", "fat", "fiber"];

export const MACRO_META: Record<MacroKey, { label: string; unit: string }> = {
	calories: { label: "Calories", unit: "kcal" },
	protein: { label: "Protein", unit: "g" },
	carbs: { label: "Carbs", unit: "g" },
	fat: { label: "Fat", unit: "g" },
	fiber: { label: "Fiber", unit: "g" },
};

export const SEXES = ["male", "female"] as const;
export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"] as const;
export const GOAL_TYPES = ["lose", "maintain", "gain"] as const;

export type Sex = (typeof SEXES)[number];
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];
export type GoalType = (typeof GOAL_TYPES)[number];

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
	sedentary: "Sedentary",
	light: "Lightly active",
	moderate: "Moderately active",
	active: "Active",
	very_active: "Very active",
};

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
	lose: "Lose weight",
	maintain: "Maintain",
	gain: "Gain weight",
};
