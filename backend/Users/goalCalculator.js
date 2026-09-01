// Pure macro-goal estimation. No DB access, no Express - just the math, so it can
// be unit tested directly and reused by the /users/me/goals/estimate endpoint.

const { ACTIVITY_MULTIPLIERS, GOAL_TYPE_ADJUST, SEXES, ACTIVITY_LEVELS, GOAL_TYPES } = require("../constants/macroDefaults");
const { DataError } = require("../error");

// Whole years between birth_date (YYYY-MM-DD) and now.
function ageFromBirthDate(birth_date, now = new Date()) {
	const birth = new Date(`${birth_date}T00:00:00Z`);
	if (Number.isNaN(birth.getTime())) throw new DataError("Invalid birth_date");

	let age = now.getUTCFullYear() - birth.getUTCFullYear();
	const beforeBirthday =
		now.getUTCMonth() < birth.getUTCMonth() ||
		(now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
	if (beforeBirthday) age -= 1;

	if (age <= 0 || age > 120) throw new DataError("birth_date is out of range");
	return age;
}

// BMR = 10*kg + 6.25*cm - 5*age + (male ? +5 : -161)
function bmrMifflinStJeor({ sex, weight_kg, height_cm, age }) {
	const s = sex === "male" ? 5 : -161;
	return 10 * weight_kg + 6.25 * height_cm - 5 * age + s;
}

function requireNumber(value, label) {
	const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
	if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) {
		throw new DataError(`${label} is required and must be a positive number`);
	}
	return n;
}

// body: { sex, birth_date, height_cm, weight_kg, activity_level, goal_type }
// returns: { bmr, tdee, goals: { calories, protein, carbs, fat, fiber } }
function estimateGoals(body = {}) {
	const { sex, birth_date, activity_level, goal_type } = body;

	if (!SEXES.includes(sex)) throw new DataError("sex must be one of: " + SEXES.join(", "));
	if (!ACTIVITY_LEVELS.includes(activity_level)) {
		throw new DataError("activity_level must be one of: " + ACTIVITY_LEVELS.join(", "));
	}
	if (!GOAL_TYPES.includes(goal_type)) {
		throw new DataError("goal_type must be one of: " + GOAL_TYPES.join(", "));
	}
	if (!birth_date || !/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
		throw new DataError("birth_date is required and must be YYYY-MM-DD");
	}

	const weight_kg = requireNumber(body.weight_kg, "weight_kg");
	const height_cm = requireNumber(body.height_cm, "height_cm");
	const age = ageFromBirthDate(birth_date);

	const bmr = bmrMifflinStJeor({ sex, weight_kg, height_cm, age });
	const tdee = bmr * ACTIVITY_MULTIPLIERS[activity_level];

	const calories = Math.round(tdee * (1 + GOAL_TYPE_ADJUST[goal_type]));
	const protein = Math.round(1.8 * weight_kg);
	const fat = Math.round((calories * 0.25) / 9);
	const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
	const fiber = Math.round((calories / 1000) * 14);

	return { bmr, tdee, goals: { calories, protein, carbs, fat, fiber } };
}

module.exports = { ageFromBirthDate, bmrMifflinStJeor, estimateGoals };
