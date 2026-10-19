const sequelize = require("../models/db");
const {
	users: usersDB,
	workouts: workoutsDB,
	diaryEntries: diaryEntriesDB,
	recipe: recipeDB,
	food: foodDB,
} = require("../models/modelInits");
const { NotFoundError, DataError } = require("../error");
const { revokeAppleToken } = require("../Auth/appleAuth");
const { GOAL_DEFAULTS, GOAL_COLUMNS, SEXES, ACTIVITY_LEVELS, GOAL_TYPES } = require("../constants/macroDefaults");
const { estimateGoals } = require("./goalCalculator");

const GOAL_KEYS = Object.keys(GOAL_COLUMNS); // calories, protein, carbs, fat, fiber
const BODY_FIELDS = ["sex", "birth_date", "height_cm", "weight_kg", "activity_level", "goal_type"];

// Shape a user row into the API response. Never leaks password / spoon_hash.
function serializeUser(user) {
	const goals = {};
	for (const [key, column] of Object.entries(GOAL_COLUMNS)) {
		goals[key] = user[column] == null ? null : Number(user[column]);
	}

	const effective_goals = { ...GOAL_DEFAULTS };
	for (const key of GOAL_KEYS) {
		if (goals[key] != null) effective_goals[key] = goals[key];
	}

	const body = {};
	for (const field of BODY_FIELDS) {
		body[field] = user[field] == null ? null : user[field];
	}

	return {
		user_id: user.user_id,
		first_name: user.first_name,
		last_name: user.last_name,
		user_name: user.user_name,
		created_at: user.createdAt,
		onboarding_completed: user.onboarding_completed,
		body,
		goals,
		effective_goals,
	};
}

async function getMe(user_id) {
	const user = await usersDB.findByPk(user_id);
	if (!user) throw new NotFoundError("User not found");
	return serializeUser(user);
}

function validateName(value, label) {
	if (typeof value !== "string" || value.trim() === "") {
		throw new DataError(`${label} must be a non-empty string`);
	}
	return value.trim();
}

function validateGoalValue(value, label) {
	if (value === null) return null;
	const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
	if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n >= 100000) {
		throw new DataError(`${label} must be a positive number below 100000, or null`);
	}
	return Math.round(n);
}

function validateMeasurement(value, label) {
	if (value === null) return null;
	const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
	if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n >= 1000) {
		throw new DataError(`${label} must be a positive number, or null`);
	}
	return n;
}

// patch: { first_name?, last_name?, sex?, birth_date?, height_cm?, weight_kg?,
//          activity_level?, goal_type?, goals?: {…}, onboarding_completed? }
async function updateMe(user_id, patch = {}) {
	const user = await usersDB.findByPk(user_id);
	if (!user) throw new NotFoundError("User not found");

	const updates = {};

	if ("first_name" in patch) updates.first_name = validateName(patch.first_name, "first_name");
	if ("last_name" in patch) updates.last_name = validateName(patch.last_name, "last_name");

	if ("sex" in patch) {
		if (patch.sex !== null && !SEXES.includes(patch.sex)) {
			throw new DataError("sex must be one of: " + SEXES.join(", "));
		}
		updates.sex = patch.sex;
	}
	if ("activity_level" in patch) {
		if (patch.activity_level !== null && !ACTIVITY_LEVELS.includes(patch.activity_level)) {
			throw new DataError("activity_level must be one of: " + ACTIVITY_LEVELS.join(", "));
		}
		updates.activity_level = patch.activity_level;
	}
	if ("goal_type" in patch) {
		if (patch.goal_type !== null && !GOAL_TYPES.includes(patch.goal_type)) {
			throw new DataError("goal_type must be one of: " + GOAL_TYPES.join(", "));
		}
		updates.goal_type = patch.goal_type;
	}
	if ("birth_date" in patch) {
		if (patch.birth_date !== null) {
			if (typeof patch.birth_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(patch.birth_date)) {
				throw new DataError("birth_date must be YYYY-MM-DD, or null");
			}
			const d = new Date(`${patch.birth_date}T00:00:00Z`);
			if (Number.isNaN(d.getTime()) || d.getTime() > Date.now()) {
				throw new DataError("birth_date must be a valid past date");
			}
		}
		updates.birth_date = patch.birth_date;
	}
	if ("height_cm" in patch) updates.height_cm = validateMeasurement(patch.height_cm, "height_cm");
	if ("weight_kg" in patch) updates.weight_kg = validateMeasurement(patch.weight_kg, "weight_kg");

	if ("onboarding_completed" in patch) {
		if (typeof patch.onboarding_completed !== "boolean") {
			throw new DataError("onboarding_completed must be a boolean");
		}
		updates.onboarding_completed = patch.onboarding_completed;
	}

	if ("goals" in patch && patch.goals != null) {
		if (typeof patch.goals !== "object" || Array.isArray(patch.goals)) {
			throw new DataError("goals must be an object");
		}
		for (const [key, value] of Object.entries(patch.goals)) {
			if (!GOAL_KEYS.includes(key)) throw new DataError(`Unknown goal field: ${key}`);
			updates[GOAL_COLUMNS[key]] = validateGoalValue(value, key);
		}
	}

	await user.update(updates);
	return serializeUser(user);
}

function estimate(body) {
	return estimateGoals(body);
}

// Permanently deletes the account and everything that's only theirs, all or nothing.
// Same idea as mergeUserInto (Auth/service.js), except the data is removed instead of moved.
// Each table is cleared explicitly rather than trusting users -> ON DELETE CASCADE to be on the live schema.
async function deleteMe(user_id) {
	let appleRefreshToken = null;

	await sequelize.transaction(async (t) => {
		const user = await usersDB.findByPk(user_id, { transaction: t });
		if (!user) throw new NotFoundError("User not found");
		appleRefreshToken = user.apple_refresh_token;

		// Foods they submitted stay: anyone can log them or use them in recipes. Just drop the link to this user.
		await foodDB.update({ submitted_by: null }, { where: { submitted_by: user_id }, transaction: t });

		// Diary entries before recipes: a diary row can point at a recipe, and only your own recipes can be logged,
		// so after this nothing references their recipes. Child rows (exercises/sets, recipe ingredients) cascade.
		await diaryEntriesDB.destroy({ where: { user_id }, transaction: t });
		await recipeDB.destroy({ where: { user_id }, transaction: t });
		await workoutsDB.destroy({ where: { user_id }, transaction: t });

		await user.destroy({ transaction: t });
	});

	// Apple requires revoking Sign in with Apple tokens on account deletion. Done after the commit so an
	// Apple outage can't stop someone deleting their account - it just gets logged.
	if (appleRefreshToken) {
		try {
			await revokeAppleToken(appleRefreshToken);
		} catch (err) {
			console.error(`Couldn't revoke Apple token for deleted user ${user_id}`, err);
		}
	}
}

module.exports = { getMe, updateMe, estimate, deleteMe, serializeUser };
