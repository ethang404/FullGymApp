// Single source of truth for the fallback macro goals used whenever a user has
// not entered their own, plus the constants the Mifflin–St Jeor calculator needs.
// The frontend keeps a mirror of GOAL_DEFAULTS in frontend/utils/macroDefaults.ts.

const GOAL_DEFAULTS = {
	calories: 2400,
	protein: 160,
	carbs: 250,
	fat: 75,
	fiber: 30,
};

// Standard TDEE activity multipliers applied to BMR.
const ACTIVITY_MULTIPLIERS = {
	sedentary: 1.2,
	light: 1.375,
	moderate: 1.55,
	active: 1.725,
	very_active: 1.9,
};

// Calorie adjustment relative to maintenance for each goal type.
const GOAL_TYPE_ADJUST = {
	lose: -0.2,
	maintain: 0,
	gain: 0.1,
};

const SEXES = ["male", "female"];
const ACTIVITY_LEVELS = Object.keys(ACTIVITY_MULTIPLIERS);
const GOAL_TYPES = Object.keys(GOAL_TYPE_ADJUST);

// The friendly goal keys and their matching column on the users table.
const GOAL_COLUMNS = {
	calories: "goal_calories",
	protein: "goal_protein_g",
	carbs: "goal_carbs_g",
	fat: "goal_fat_g",
	fiber: "goal_fiber_g",
};

module.exports = {
	GOAL_DEFAULTS,
	ACTIVITY_MULTIPLIERS,
	GOAL_TYPE_ADJUST,
	SEXES,
	ACTIVITY_LEVELS,
	GOAL_TYPES,
	GOAL_COLUMNS,
};
