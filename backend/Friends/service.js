const {
	users: usersModel,
	friendships: friendshipModel,
	friend_permissions: friend_permissionsModel,
} = require("../models/modelInits");
const { Op } = require("sequelize");
const sequelize = require("../models/db");
const { NotFoundError, DataError, ForbiddenError, ConflictError } = require("../error");
const WorkoutsService = require("../Workouts/service");
const NutritionService = require("../Nutrition/service");
const { serializeUser, toPublicUser } = require("../serializers/users");
const { serializeWorkoutListItem } = require("../serializers/workouts");
const { isBlocked, friendshipPair } = require("../utils/social");
const { PUBLIC_USER_ATTRIBUTES } = require("../constants/social");
const { parseDateRange } = require("../utils/dates");

//the 4 toggles on a friend_permissions row
const SHARE_KEYS = ["workouts", "recipes", "diary", "goals"];
// Functions Friends/controller.js calls (viewer/actor is always the first user_id):
//
// getRequests(user_id)                                          -> { incoming, outgoing }
// sendRequest(user_id, target_user_id)                          -> friendship
// acceptRequest(friendship_id, user_id)                         -> friendship
// deleteRequest(friendship_id, user_id)
// getFriends(user_id)                                           -> [{ ...user, i_share, they_share }]
// removeFriend(user_id, friend_id)
// updatePermissions(user_id, friend_id, patch)                  -> my friend_permissions row
// getFriendOverview(user_id, friend_id, start_date, end_date)
//                                                               -> { user, they_share, workouts?, recipes?, diary?, goals? }
//                                                                  (workouts in the GET /workouts list shape)
// getFriendWorkout(user_id, friend_id, workout_id)              -> workout (editor shape, same as GET /workouts/:id)
// getFriendRecipe(user_id, friend_id, recipe_id)                -> recipe

//block helpers (isBlocked / getHiddenUserIds) live in utils/social.js - Groups, Posts and Users use them too

async function getRequests(user_id) {
	//all pending requests I'm part of incoming/outgoing
	const pending = await friendshipModel.findAll({
		where: {
			status: "pending",
			[Op.or]: [{ user_id_a: user_id }, { user_id_b: user_id }],
		},
		include: [
			{ model: usersModel, as: "userA", attributes: PUBLIC_USER_ATTRIBUTES },
			{ model: usersModel, as: "userB", attributes: PUBLIC_USER_ATTRIBUTES },
		],
		order: [["created_at", "DESC"]],
	});

	const incoming = [];
	const outgoing = [];
	for (const row of pending) {
		const { userA, userB, ...friendship } = row.get({ plain: true });

		const request = { ...friendship, user: userA.user_id === user_id ? userB : userA };
		if (friendship.requested_by === user_id) outgoing.push(request);
		else incoming.push(request);
	}

	return { incoming, outgoing };
}

async function sendRequest(user_id, target_user_id) {
	if (user_id === target_user_id) throw new DataError("You can't friend yourself");

	const target = await usersModel.findByPk(target_user_id, { attributes: ["user_id", "is_guest"] });
	if (!target || target.is_guest) throw new NotFoundError("User not found");

	if (await isBlocked(user_id, target_user_id)) throw new ForbiddenError("Can't send a friend request to this user");

	//rows are always stored smaller id first
	const { user_id_a, user_id_b } = friendshipPair(user_id, target_user_id);

	const existing = await friendshipModel.findOne({ where: { user_id_a, user_id_b } });
	if (existing) {
		if (existing.status === "accepted") throw new ConflictError("You're already friends");
		if (existing.requested_by === user_id) throw new ConflictError("Request already sent");
		//they already asked me, so sending one back just accepts theirs
		return acceptRequest(existing.id, user_id);
	}

	return friendshipModel.create({ user_id_a, user_id_b, requested_by: user_id });
}

async function acceptRequest(friendship_row_id, user_id) {
	//friendship_row_id is the row that finds the friendship relation for 2 users
	const friendship_row = await friendshipModel.findByPk(friendship_row_id);

	//same 404 if it doesn't exist or isn't my relation
	if (!friendship_row || (friendship_row.user_id_a !== user_id && friendship_row.user_id_b !== user_id)) {
		throw new NotFoundError("Friend request not found");
	}

	if (friendship_row.status === "accepted") throw new ConflictError("You're already friends");
	if (friendship_row.requested_by === user_id) throw new ForbiddenError("You can't accept your own request");

	//status flip + both permissions created
	return sequelize.transaction(async (t) => {
		await friendship_row.update({ status: "accepted" }, { transaction: t });

		//both users get assigned default permissions for this relation
		await friend_permissionsModel.bulkCreate(
			[
				{ friendship_id: friendship_row_id, owner_id: friendship_row.user_id_a },
				{ friendship_id: friendship_row_id, owner_id: friendship_row.user_id_b },
			],
			{ transaction: t },
		);
		return friendship_row;
	});
}

async function deleteRequest(friendship_row_id, user_id) {
	//friendship_row_id is the row that finds the friendship relation for 2 users
	const friendship_row = await friendshipModel.findByPk(friendship_row_id);

	//same 404 if it doesn't exist or isn't my relation
	if (!friendship_row || (friendship_row.user_id_a !== user_id && friendship_row.user_id_b !== user_id)) {
		throw new NotFoundError("Friend request not found");
	}
	if (friendship_row.status === "accepted") throw new ConflictError("Already friends - use remove friend instead");

	await friendship_row.destroy();
}

//Actual Friend endpoints
async function getFriends(user_id) {
	//all pending requests I'm part of incoming/outgoing
	const permission_attributes = ["owner_id", "workouts", "recipes", "diary", "goals"];
	const friendships = await friendshipModel.findAll({
		where: {
			status: "accepted",
			[Op.or]: [{ user_id_a: user_id }, { user_id_b: user_id }],
		},
		include: [
			{ model: usersModel, as: "userA", attributes: PUBLIC_USER_ATTRIBUTES },
			{ model: usersModel, as: "userB", attributes: PUBLIC_USER_ATTRIBUTES },
			{ model: friend_permissionsModel, as: "permissions", attributes: permission_attributes },
		],
		order: [["created_at", "DESC"]],
	});

	const friends = [];
	for (const row of friendships) {
		const friendship = row.get({ plain: true });
		const other = friendship.userA.user_id === user_id ? friendship.userB : friendship.userA;

		const i_share = friendship.permissions.find((p) => p.owner_id === user_id);
		const they_share = friendship.permissions.find((p) => p.owner_id === other.user_id);

		friends.push({ ...other, i_share, they_share });
	}
	return friends;
}

async function removeFriend(user_id, friend_id) {
	const friendship = await friendshipModel.findOne({
		where: {
			status: "accepted",
			...friendshipPair(user_id, friend_id),
		},
	});

	if (!friendship) throw new NotFoundError("You're not friends with this user");
	await friendship.destroy();
}

//find friend relation between user_id | friend_id
//owner_id is the one we care about permissions on:
//user_id==owner_id->What I share with them
//friend_id==owner_id->What they share with me
async function findPermissionRow(user_id, friend_id, owner_id) {
	const friendship = await friendshipModel.findOne({
		where: {
			status: "accepted",
			...friendshipPair(user_id, friend_id),
		},
		include: { model: friend_permissionsModel, as: "permissions", where: { owner_id } },
	});

	if (!friendship) throw new NotFoundError("You're not friends with this user");
	return friendship.permissions[0];
}

//Updating permissions on what friend can see
async function updatePermissions(user_id, friend_id, data) {
	const my_permissions = await findPermissionRow(user_id, friend_id, user_id);

	//update toggles
	const updates = {};
	for (const key of SHARE_KEYS) {
		if (typeof data[key] === "boolean") updates[key] = data[key];
	}

	await my_permissions.update(updates);
	return my_permissions;
}

//Viewing a friend's data
async function getFriendOverview(user_id, friend_id, start_date, end_date) {
	const their_permissions = await findPermissionRow(user_id, friend_id, friend_id);

	//workouts + diary need explicit ranges. Validated once here - the workouts query doesn't check them itself
	({ start_date, end_date } = parseDateRange(start_date, end_date));

	const friend_row = await usersModel.findByPk(friend_id);

	const they_share = {};
	for (const key of SHARE_KEYS) they_share[key] = their_permissions[key];

	//body (weight, birth date etc.) is never sent, only the public profile
	const overview = {
		user: toPublicUser(friend_row),
		they_share,
	};

	//sections they don't share are left out entirely
	if (they_share.workouts) {
		//range query is oldest first, profile wants newest first. Same list shape as GET /workouts
		const workouts = await WorkoutsService.getWorkoutsInRange(friend_id, start_date, end_date);
		overview.workouts = workouts.reverse().map(serializeWorkoutListItem);
	}
	if (they_share.recipes) overview.recipes = await NutritionService.getRecipes(friend_id);
	if (they_share.diary) overview.diary = await NutritionService.getDiaryEntries(friend_id, start_date, end_date);
	if (they_share.goals) overview.goals = serializeUser(friend_row).effective_goals; //macro goals only, never body metrics

	return overview;
}

async function getFriendWorkout(user_id, friend_id, workout_id) {
	const their_permissions = await findPermissionRow(user_id, friend_id, friend_id);
	if (!their_permissions.workouts) throw new ForbiddenError("This friend doesn't share their workouts");

	//GetWorkout only matches workouts owned by friend_id, so anyone else's workout id is a 404
	return WorkoutsService.GetWorkout(workout_id, friend_id);
}

async function getFriendRecipe(user_id, friend_id, recipe_id) {
	const their_permissions = await findPermissionRow(user_id, friend_id, friend_id);
	if (!their_permissions.recipes) throw new ForbiddenError("This friend doesn't share their recipes");

	//same as workouts - getRecipe only matches recipes owned by friend_id
	return NutritionService.getRecipe(recipe_id, friend_id);
}

module.exports = {
	getRequests,
	sendRequest,
	acceptRequest,
	deleteRequest,
	getFriends,
	removeFriend,
	updatePermissions,
	getFriendOverview,
	getFriendWorkout,
	getFriendRecipe,
};
