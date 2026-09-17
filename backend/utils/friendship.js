const { Op } = require("sequelize");
const { friendships } = require("../models/modelInits");

// Friendship rows are always stored with user_id_a < user_id_b (see Friends/service.js),
// so every lookup has to re-derive that same min/max ordering before querying.
//this way userA friends with userB relation is always A, B. Never swapped by accident
async function areFriends(userIdA, userIdB) {
	if (userIdA == null || userIdB == null || userIdA === userIdB) return false;
	const [user_id_a, user_id_b] = userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];

	const row = await friendships.findOne({ where: { user_id_a, user_id_b, status: "accepted" } });
	return !!row;
}

// Shared visibility check used by any single-resource read (recipe, workout, ...):
// owner always sees their own content, 'public' is visible to anyone, 'friends'
// requires an accepted friendship, 'private' is owner-only.
async function canViewContent(ownerUserId, viewerUserId, visibility) {
	if (ownerUserId === viewerUserId) return true;
	if (visibility === "public") return true;
	if (visibility === "friends") return areFriends(ownerUserId, viewerUserId);
	return false;
}

// All of the caller's accepted-friend user_ids, in one query - used by feeds (Explore) that
// need to filter a whole result set by friendship rather than check one relationship at a time.
async function getFriendIds(user_id) {
	const rows = await friendships.findAll({
		where: { status: "accepted", [Op.or]: [{ user_id_a: user_id }, { user_id_b: user_id }] },
		attributes: ["user_id_a", "user_id_b"],
	});
	return rows.map((row) => (row.user_id_a === user_id ? row.user_id_b : row.user_id_a));
}

module.exports = { areFriends, canViewContent, getFriendIds };
