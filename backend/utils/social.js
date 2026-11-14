//Block + friendship helpers shared by Friends, Groups, Posts and Users.
//Only requires models - never a feature service - so any service can import it without a circular require
const { Op } = require("sequelize");
const { blocked_users: blockedModel, users: usersModel } = require("../models/modelInits");

//true if either of us blocked the other
async function isBlocked(user_id, target_user_id) {
	const block = await blockedModel.findOne({
		where: {
			[Op.or]: [
				{ blocker_id: user_id, blocked_user_id: target_user_id },
				{ blocker_id: target_user_id, blocked_user_id: user_id },
			],
		},
	});
	return block !== null;
}

//everyone hidden from me -> their ids. That's anyone I'm blocked with (either direction) plus anyone banned
async function getHiddenUserIds(user_id) {
	const [rows, banned] = await Promise.all([
		blockedModel.findAll({
			where: { [Op.or]: [{ blocker_id: user_id }, { blocked_user_id: user_id }] },
			attributes: ["blocker_id", "blocked_user_id"],
			raw: true,
		}),
		usersModel.findAll({ where: { is_banned: true }, attributes: ["user_id"], raw: true }),
	]);

	const blocked_ids = rows.map((row) => (row.blocker_id === user_id ? row.blocked_user_id : row.blocker_id));
	return [...blocked_ids, ...banned.map((row) => row.user_id)];
}

//adds "not written by anyone hidden from me" to a where.
//This REPLACES where.user_id, so don't use it on a query that already filters by user_id -
//check getHiddenUserIds directly instead (see getUserPosts)
async function excludeHiddenUsers(where, user_id) {
	const hidden_user_ids = await getHiddenUserIds(user_id);
	if (hidden_user_ids.length > 0) where.user_id = { [Op.notIn]: hidden_user_ids };
	return where;
}

//friendship rows are always stored smaller id first
function friendshipPair(user_id, other_id) {
	return { user_id_a: Math.min(user_id, other_id), user_id_b: Math.max(user_id, other_id) };
}

module.exports = { isBlocked, getHiddenUserIds, excludeHiddenUsers, friendshipPair };
