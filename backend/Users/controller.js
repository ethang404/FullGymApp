const service = require("./service");
const postsService = require("../Posts/service");

async function getMe(req, res) {
	const user = await service.getMe(req.user_id);
	return res.status(200).json({ user });
}

async function updateMe(req, res) {
	const user = await service.updateMe(req.user_id, req.body);
	return res.status(200).json({ user });
}

async function estimateGoals(req, res) {
	const estimate = service.estimate(req.body);
	return res.status(200).json({ estimate });
}

async function deleteMe(req, res) {
	await service.deleteMe(req.user_id);
	return res.status(200).json({ message: "Account deleted" });
}

//route is in Admin/route.js. Body needs: { is_banned }
async function setBanned(req, res) {
	const user_id = parseInt(req.params.id, 10);
	const is_banned = req.body?.is_banned;
	await service.setBanned(user_id, req.user_id, is_banned);
	return res.status(200).json({ message: is_banned ? "User banned" : "User unbanned" });
}

// ---------------------------------------------
// Social
// ---------------------------------------------

// /users/search?q=ali
async function searchUsers(req, res) {
	const { q } = req.query;
	const users = await service.searchUsers(req.user_id, q);
	return res.status(200).json({ users });
}

async function getBlockedUsers(req, res) {
	const users = await service.getBlockedUsers(req.user_id);
	return res.status(200).json({ users });
}

async function blockUser(req, res) {
	const blocked_user_id = parseInt(req.params.id, 10);
	await service.blockUser(req.user_id, blocked_user_id);
	return res.status(200).json({ message: "User blocked" });
}

async function unblockUser(req, res) {
	const blocked_user_id = parseInt(req.params.id, 10);
	await service.unblockUser(req.user_id, blocked_user_id);
	return res.status(200).json({ message: "User unblocked" });
}

// /users/:id/posts?cursor=...&limit=20 - lives in Posts/service.js with the other feeds
async function getUserPosts(req, res) {
	const target_user_id = parseInt(req.params.id, 10);
	const { cursor, limit } = req.query;
	const feed = await postsService.getUserPosts(target_user_id, req.user_id, { cursor, limit }); //{ posts, next_cursor }
	return res.status(200).json(feed);
}

module.exports = {
	getMe,
	updateMe,
	estimateGoals,
	deleteMe,
	setBanned,
	searchUsers,
	getBlockedUsers,
	blockUser,
	unblockUser,
	getUserPosts,
};
