//Shapes user rows for the frontend.
//Serializers are leaf modules: they only require constants (never models or services), so any service can use them
const { GOAL_DEFAULTS, GOAL_COLUMNS, GOAL_KEYS, BODY_FIELDS, PUBLIC_USER_ATTRIBUTES } = require("../constants");

//my own profile. Never leaks password / spoon_hash. Never send this for someone else (body metrics + goals)
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

//what other people see: user_id, user_name, first/last name
function toPublicUser(user) {
	return Object.fromEntries(PUBLIC_USER_ATTRIBUTES.map((key) => [key, user[key]]));
}

module.exports = { serializeUser, toPublicUser };
