const service = require("./service");
const { handleError } = require("../utils/http");
const postsService = require("../Posts/service");

async function getMe(req, res) {
	try {
		const user = await service.getMe(req.user_id);
		return res.status(200).json({ user });
	} catch (error) {
		return handleError(res, error);
	}
}

async function updateMe(req, res) {
	try {
		const user = await service.updateMe(req.user_id, req.body);
		return res.status(200).json({ user });
	} catch (error) {
		return handleError(res, error);
	}
}

async function estimateGoals(req, res) {
	try {
		const estimate = service.estimate(req.body);
		return res.status(200).json({ estimate });
	} catch (error) {
		return handleError(res, error);
	}
}

async function deleteMe(req, res) {
	try {
		await service.deleteMe(req.user_id);
		return res.status(200).json({ message: "Account deleted" });
	} catch (error) {
		return handleError(res, error);
	}
}

// ---------------------------------------------
// Social
// ---------------------------------------------

// /users/search?q=ali
async function searchUsers(req, res) {
	const { q } = req.query;
	try {
		const users = await service.searchUsers(req.user_id, q);
		return res.status(200).json({ users });
	} catch (error) {
		return handleError(res, error);
	}
}

async function getBlockedUsers(req, res) {
	try {
		const users = await service.getBlockedUsers(req.user_id);
		return res.status(200).json({ users });
	} catch (error) {
		return handleError(res, error);
	}
}

async function blockUser(req, res) {
	const blocked_user_id = parseInt(req.params.id, 10);
	try {
		await service.blockUser(req.user_id, blocked_user_id);
		return res.status(200).json({ message: "User blocked" });
	} catch (error) {
		return handleError(res, error);
	}
}

async function unblockUser(req, res) {
	const blocked_user_id = parseInt(req.params.id, 10);
	try {
		await service.unblockUser(req.user_id, blocked_user_id);
		return res.status(200).json({ message: "User unblocked" });
	} catch (error) {
		return handleError(res, error);
	}
}

// /users/:id/posts?cursor=...&limit=20 - lives in Posts/service.js with the other feeds
async function getUserPosts(req, res) {
	const target_user_id = parseInt(req.params.id, 10);
	const { cursor, limit } = req.query;
	try {
		const feed = await postsService.getUserPosts(target_user_id, req.user_id, { cursor, limit }); //{ posts, next_cursor }
		return res.status(200).json(feed);
	} catch (error) {
		return handleError(res, error);
	}
}

module.exports = {
	getMe,
	updateMe,
	estimateGoals,
	deleteMe,
	searchUsers,
	getBlockedUsers,
	blockUser,
	unblockUser,
	getUserPosts,
};
