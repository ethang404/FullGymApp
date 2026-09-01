// Fixtures for users.test.js — mirrors the NutritionPayloads.js / WorkoutPayloads.js convention.

const addUserPayload = {
	firstName: "Casey",
	lastName: "Rivers",
	userName: "casey_goals",
	password: "GoalsUser123!",
};

// A fully specified body for the TDEE calculator. Deterministic except for age,
// which the test derives from birth_date the same way the server is expected to.
const estimateBodyPayload = {
	sex: "male",
	birth_date: "1990-01-01",
	height_cm: 180,
	weight_kg: 80,
	activity_level: "moderate",
	goal_type: "maintain",
};

const estimateBodyPayloadFemaleCut = {
	sex: "female",
	birth_date: "1995-06-15",
	height_cm: 165,
	weight_kg: 65,
	activity_level: "light",
	goal_type: "lose",
};

// Shared expectations of the macro math, kept here so both the assertion and the
// reader see the contract in one place. These encode the plan's formula, not the
// implementation.
const ACTIVITY_MULTIPLIERS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
const GOAL_TYPE_ADJUST = { lose: -0.2, maintain: 0, gain: 0.1 };

function ageFromBirthDate(birth_date, now = new Date()) {
	const b = new Date(birth_date + "T00:00:00Z");
	let age = now.getUTCFullYear() - b.getUTCFullYear();
	const beforeBirthday =
		now.getUTCMonth() < b.getUTCMonth() ||
		(now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate());
	if (beforeBirthday) age -= 1;
	return age;
}

function expectedEstimate(body) {
	const age = ageFromBirthDate(body.birth_date);
	const s = body.sex === "male" ? 5 : -161;
	const bmr = 10 * body.weight_kg + 6.25 * body.height_cm - 5 * age + s;
	const tdee = bmr * ACTIVITY_MULTIPLIERS[body.activity_level];
	const calories = Math.round(tdee * (1 + GOAL_TYPE_ADJUST[body.goal_type]));
	const protein = Math.round(1.8 * body.weight_kg);
	const fat = Math.round((calories * 0.25) / 9);
	const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
	const fiber = Math.round((calories / 1000) * 14);
	return { bmr, tdee, goals: { calories, protein, carbs, fat, fiber } };
}

module.exports = {
	addUserPayload,
	estimateBodyPayload,
	estimateBodyPayloadFemaleCut,
	ageFromBirthDate,
	expectedEstimate,
};
