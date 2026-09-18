const { Op } = require("sequelize");
const { friendships: FriendshipsModel, users: UsersModel } = require("../models/modelInits");
const { NotFoundError, DataError, ForbiddenError } = require("../error");

const USER_ATTRS = ["user_id", "user_name", "first_name", "last_name"];

// Friendship rows are always stored with user_id_a < user_id_b (see friendships.model.js),
// so a single unique index on (user_id_a, user_id_b) blocks both exact duplicates and
// reciprocal A->B / B->A rows. Every lookup/write has to re-derive that same ordering.
function orderPair(userIdA, userIdB) {
	return userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
}

// Given a friendship row (with userA/userB included) and one of its two parties,
// returns the *other* party's user record.
function otherUser(friendship, user_id) {
	return friendship.userA.user_id === user_id ? friendship.userB : friendship.userA;
}

/**
 * POST /friends/requests
 * Expected: { addressee_user_id }
 * If the addressee already has a pending request out to the sender, this auto-accepts
 * (mutual match) instead of erroring or creating a second row.
 */
async function sendRequest(user_id, addressee_user_id) {
	addressee_user_id = parseInt(addressee_user_id, 10);
	if (isNaN(addressee_user_id)) throw new DataError("addressee_user_id is required");
	if (addressee_user_id === user_id) throw new DataError("Cannot send a friend request to yourself");

	const addressee = await UsersModel.findByPk(addressee_user_id);
	if (!addressee) throw new NotFoundError("User not found");

	const [user_id_a, user_id_b] = orderPair(user_id, addressee_user_id);
	const existing = await FriendshipsModel.findOne({ where: { user_id_a, user_id_b } });

	if (!existing) {
		const friendship = await FriendshipsModel.create({ user_id_a, user_id_b, requested_by: user_id, status: "pending" });
		return { friendship, created: true };
	}

	if (existing.status === "accepted") throw new DataError("Already friends");

	// existing.status === "pending"
	if (existing.requested_by === user_id) throw new DataError("Friend request already pending");

	// The other user already requested us - treat this as a mutual match.
	await existing.update({ status: "accepted" });
	return { friendship: existing, created: false };
}

/**
 * POST /friends/requests/:id/accept — addressee-only.
 */
async function acceptRequest(friendship_id, user_id) {
	const row = await FriendshipsModel.findByPk(friendship_id);
	if (!row) throw new NotFoundError("Friend request not found");
	if (row.user_id_a !== user_id && row.user_id_b !== user_id) throw new ForbiddenError("Not your friend request");
	if (row.status !== "pending") throw new DataError("Friend request is not pending");
	if (row.requested_by === user_id) throw new ForbiddenError("Cannot accept your own outgoing request");

	await row.update({ status: "accepted" });
	return row;
}

/**
 * DELETE /friends/requests/:id — decline (addressee) or cancel (requester) a pending request.
 */
async function deletePendingRequest(friendship_id, user_id) {
	const row = await FriendshipsModel.findByPk(friendship_id);
	if (!row) throw new NotFoundError("Friend request not found");
	if (row.user_id_a !== user_id && row.user_id_b !== user_id) throw new ForbiddenError("Not your friend request");
	if (row.status !== "pending") throw new DataError("Friend request is not pending");

	await row.destroy();
	return { deleted: true, id: friendship_id };
}

/**
 * DELETE /friends/:id — unfriend an accepted friendship, either party.
 */
async function removeFriend(friendship_id, user_id) {
	const row = await FriendshipsModel.findByPk(friendship_id);
	if (!row) throw new NotFoundError("Friendship not found");
	if (row.user_id_a !== user_id && row.user_id_b !== user_id) throw new ForbiddenError("Not your friendship");
	if (row.status !== "accepted") throw new DataError("Not currently friends");

	await row.destroy();
	return { deleted: true, id: friendship_id };
}

/**
 * GET /friends — accepted friends, newest-accepted first.
 */
async function listFriends(user_id) {
	const rows = await FriendshipsModel.findAll({
		where: { status: "accepted", [Op.or]: [{ user_id_a: user_id }, { user_id_b: user_id }] },
		include: [
			{ model: UsersModel, as: "userA", attributes: USER_ATTRS },
			{ model: UsersModel, as: "userB", attributes: USER_ATTRS },
		],
		order: [["updatedAt", "DESC"]],
	});

	return rows.map((row) => {
		const friend = otherUser(row, user_id);
		return {
			friendship_id: row.id,
			user_id: friend.user_id,
			user_name: friend.user_name,
			first_name: friend.first_name,
			last_name: friend.last_name,
			since: row.updatedAt,
		};
	});
}

/**
 * GET /friends/requests?direction=incoming|outgoing
 */
async function listRequests(user_id, direction) {
	if (!["incoming", "outgoing"].includes(direction)) throw new DataError("direction must be 'incoming' or 'outgoing'");

	const where = { status: "pending", [Op.or]: [{ user_id_a: user_id }, { user_id_b: user_id }] };
	where.requested_by = direction === "outgoing" ? user_id : { [Op.ne]: user_id };

	const rows = await FriendshipsModel.findAll({
		where,
		include: [
			{ model: UsersModel, as: "userA", attributes: USER_ATTRS },
			{ model: UsersModel, as: "userB", attributes: USER_ATTRS },
		],
		order: [["createdAt", "DESC"]],
	});

	return rows.map((row) => {
		const otherParty = otherUser(row, user_id);
		return {
			friendship_id: row.id,
			user_id: otherParty.user_id,
			user_name: otherParty.user_name,
			first_name: otherParty.first_name,
			last_name: otherParty.last_name,
			requested_at: row.createdAt,
		};
	});
}

/**
 * GET /friends/search?query=&limit=
 * Search users by username/name (excluding self), annotated with the caller's current
 * relationship to each result so the frontend can render the right button.
 */
async function searchUsers(user_id, query, limit) {
	if (!query || !query.trim()) throw new DataError("query is required");
	const sanitized = query.trim();
	limit = Math.min(parseInt(limit, 10) || 20, 50);

	const results = await UsersModel.findAll({
		where: {
			user_id: { [Op.ne]: user_id },
			[Op.or]: [
				{ user_name: { [Op.iLike]: `%${sanitized}%` } },
				{ first_name: { [Op.iLike]: `%${sanitized}%` } },
				{ last_name: { [Op.iLike]: `%${sanitized}%` } },
			],
		},
		attributes: USER_ATTRS,
		limit,
	});

	if (results.length === 0) return [];

	// Batch-fetch every friendship row touching the caller and any result, to avoid an
	// N+1 relationship lookup per search result.
	const relevantRows = await FriendshipsModel.findAll({
		where: {
			[Op.or]: results.map((u) => {
				const [user_id_a, user_id_b] = orderPair(user_id, u.user_id);
				return { user_id_a, user_id_b };
			}),
		},
	});

	const stateByUserId = new Map();
	for (const row of relevantRows) {
		const otherId = row.user_id_a === user_id ? row.user_id_b : row.user_id_a;
		if (row.status === "accepted") stateByUserId.set(otherId, "friends");
		else if (row.requested_by === user_id) stateByUserId.set(otherId, "pending_outgoing");
		else stateByUserId.set(otherId, "pending_incoming");
	}

	return results.map((u) => ({
		user_id: u.user_id,
		user_name: u.user_name,
		first_name: u.first_name,
		last_name: u.last_name,
		relationship: stateByUserId.get(u.user_id) ?? "none",
	}));
}

module.exports = {
	sendRequest,
	acceptRequest,
	deletePendingRequest,
	removeFriend,
	listFriends,
	listRequests,
	searchUsers,
};
