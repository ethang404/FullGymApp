const sequelize = require("../models/db");
const {
	users: usersDB,
	workouts: workoutsDB,
	diaryEntries: diaryEntriesDB,
	recipe: recipeDB,
	food: foodDB,
	blocked_users: blockedDB,
	friendships: friendshipsDB,
	group_members: membersModel,
	groups: groupsModel,
} = require("../models/modelInits");
const { Op } = require("sequelize");
const { getHiddenUserIds, friendshipPair } = require("../utils/social");
const { NotFoundError, DataError } = require("../error");
const { revokeAppleToken } = require("../Auth/appleAuth");
const { PUBLIC_USER_ATTRIBUTES, GOAL_KEYS, GOAL_COLUMNS, SEXES, ACTIVITY_LEVELS, GOAL_TYPES } = require("../constants");
const { serializeUser } = require("../serializers/users");
const { estimateGoals } = require("./goalCalculator");

//serializeUser lives in serializers/users.js (Friends uses it too)

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
//Clear each table manually in case of future migrations
async function deleteMe(user_id) {
	let appleRefreshToken = null;

	await sequelize.transaction(async (t) => {
		const user = await usersDB.findByPk(user_id, { transaction: t });
		if (!user) throw new NotFoundError("User not found");
		appleRefreshToken = user.apple_refresh_token;

		//Submitted foods remain with no user_id
		await foodDB.update({ submitted_by: null }, { where: { submitted_by: user_id }, transaction: t });

		//Delete main interactions for that user in this order (since diaryEntries can reference recipes)
		await diaryEntriesDB.destroy({ where: { user_id }, transaction: t });
		await recipeDB.destroy({ where: { user_id }, transaction: t });
		await workoutsDB.destroy({ where: { user_id }, transaction: t });

		//For each group the user is an owner of: replace with oldest admin if there is one.
		//else: oldest member
		//else: just owner in group: delete
		//also remove any row in blocked table
		const owned = await membersModel.findAll({
			where: { user_id, role: "owner", status: "active" }, //my owner rows
			include: [
				{
					model: groupsModel, //join w/ group name and stuff
					include: [
						{
							model: membersModel, //then looking at other members in this group
							as: "memberships",
							where: { user_id: { [Op.ne]: user_id }, status: "active" }, //everyone else who's actually in
							required: false, //keep groups where I'm the only one -> memberships = []
						},
					],
				},
			],
			order: [
				//sorting a nested include: list the path to it, then the column
				[groupsModel, { model: membersModel, as: "memberships" }, "role", "ASC"], //admin before member
				[groupsModel, { model: membersModel, as: "memberships" }, "createdAt", "ASC"], //then oldest
			],
			transaction: t,
		});

		//split my groups: someone to hand it to, or nobody left (delete it)
		const successors = [];
		const empty_group_ids = [];
		for (const row of owned) {
			const next_owner = row.group.memberships[0]; //already sorted: admins first, then oldest
			if (next_owner) successors.push({ group_id: row.group_id, user_id: next_owner.user_id });
			else empty_group_ids.push(row.group_id);
		}

		//promote every successor at once - each pair is one specific membership row
		if (successors.length > 0) {
			await membersModel.update({ role: "owner" }, { where: { [Op.or]: successors }, transaction: t });
		}

		//groups where I was the only member. Their memberships + posts cascade
		if (empty_group_ids.length > 0) {
			await groupsModel.destroy({ where: { id: empty_group_ids }, transaction: t });
		}

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

// ---------------------------------------------
// Social
// ---------------------------------------------
//matches username or first/last name. Never me, guests, or anyone I'm blocked with
async function searchUsers(user_id, q) {
	const search = typeof q === "string" ? q.trim() : "";
	if (!search) return [];

	const hidden_ids = await getHiddenUserIds(user_id);

	return usersDB.findAll({
		where: {
			user_id: { [Op.notIn]: [user_id, ...hidden_ids] },
			is_guest: false,
			[Op.or]: [{ user_name: { [Op.iLike]: `%${search}%` } }, { first_name: { [Op.iLike]: `%${search}%` } }, { last_name: { [Op.iLike]: `%${search}%` } }],
		},
		attributes: PUBLIC_USER_ATTRIBUTES,
		order: [["user_name", "ASC"]],
		limit: 20,
	});
}

//people *I* blocked (never who blocked me), newest first
async function getBlockedUsers(user_id) {
	const rows = await blockedDB.findAll({
		where: { blocker_id: user_id },
		include: [{ model: usersDB, as: "blockedUser", attributes: PUBLIC_USER_ATTRIBUTES }],
		order: [["createdAt", "DESC"]],
	});

	return rows.map((row) => ({ ...row.blockedUser.toJSON(), blocked_at: row.createdAt }));
}

//idempotent - blocking twice is a no-op. Also removes any friendship/pending request between us
async function blockUser(user_id, blocked_user_id) {
	if (!Number.isInteger(blocked_user_id)) throw new DataError("Invalid user id");
	if (blocked_user_id === user_id) throw new DataError("You can't block yourself");

	const target = await usersDB.findByPk(blocked_user_id, { attributes: ["user_id"] });
	if (!target) throw new NotFoundError("User not found");

	await sequelize.transaction(async (t) => {
		await blockedDB.findOrCreate({ where: { blocker_id: user_id, blocked_user_id }, transaction: t });

		//friendship rows are stored smaller id first. Permission rows cascade with it
		await friendshipsDB.destroy({
			where: friendshipPair(user_id, blocked_user_id),
			transaction: t,
		});
	});
}

//idempotent - unblocking someone you never blocked is a no-op. Only removes MY block (theirs stays if they have one)
async function unblockUser(user_id, blocked_user_id) {
	if (!Number.isInteger(blocked_user_id)) throw new DataError("Invalid user id");
	await blockedDB.destroy({ where: { blocker_id: user_id, blocked_user_id } });
}

module.exports = { getMe, updateMe, estimate, deleteMe, searchUsers, getBlockedUsers, blockUser, unblockUser };
