const service = require("./service");
const { handleError } = require("../utils/http");

// ---------------------------------------------
// Posts
// ---------------------------------------------

// /posts/public?cursor=...&limit=20
async function getPublicFeed(req, res) {
	const { cursor, limit } = req.query;
	try {
		const feed = await service.getPublicFeed(req.user_id, { cursor, limit }); //{ posts, next_cursor }
		return res.status(200).json(feed);
	} catch (error) {
		return handleError(res, error);
	}
}

// Body needs: { visibility, group_id?, workout_id? | recipe_id?, caption? }
async function createPost(req, res) {
	try {
		const post = await service.createPost(req.user_id, req.body);
		return res.status(201).json({ post });
	} catch (error) {
		return handleError(res, error);
	}
}

async function getPost(req, res) {
	const post_id = parseInt(req.params.id, 10);
	try {
		const post = await service.getPost(post_id, req.user_id);
		return res.status(200).json({ post });
	} catch (error) {
		return handleError(res, error);
	}
}

// Body: { caption }
async function updatePost(req, res) {
	const post_id = parseInt(req.params.id, 10);
	try {
		const post = await service.updatePost(post_id, req.user_id, req.body);
		return res.status(200).json({ post });
	} catch (error) {
		return handleError(res, error);
	}
}

async function deletePost(req, res) {
	const post_id = parseInt(req.params.id, 10);
	try {
		await service.deletePost(post_id, req.user_id);
		return res.status(200).json({ message: "Post deleted" });
	} catch (error) {
		return handleError(res, error);
	}
}

async function saveRecipe(req, res) {
	const post_id = parseInt(req.params.id, 10);
	try {
		const recipe = await service.saveRecipe(post_id, req.user_id);
		return res.status(201).json({ recipe });
	} catch (error) {
		return handleError(res, error);
	}
}

// ---------------------------------------------
// Likes
// ---------------------------------------------

async function likePost(req, res) {
	const post_id = parseInt(req.params.id, 10);
	try {
		await service.likePost(post_id, req.user_id);
		return res.status(200).json({ message: "Liked" });
	} catch (error) {
		return handleError(res, error);
	}
}

async function unlikePost(req, res) {
	const post_id = parseInt(req.params.id, 10);
	try {
		await service.unlikePost(post_id, req.user_id);
		return res.status(200).json({ message: "Unliked" });
	} catch (error) {
		return handleError(res, error);
	}
}

// ---------------------------------------------
// Comments
// ---------------------------------------------

// /posts/:id/comments?cursor=...&limit=20
async function getComments(req, res) {
	const post_id = parseInt(req.params.id, 10);
	const { cursor, limit } = req.query;
	try {
		const result = await service.getComments(post_id, req.user_id, { cursor, limit }); //{ comments, next_cursor }
		return res.status(200).json(result);
	} catch (error) {
		return handleError(res, error);
	}
}

// Body needs: { body }
async function addComment(req, res) {
	const post_id = parseInt(req.params.id, 10);
	const { body } = req.body;
	try {
		const comment = await service.addComment(post_id, req.user_id, body);
		return res.status(201).json({ comment });
	} catch (error) {
		return handleError(res, error);
	}
}

async function deleteComment(req, res) {
	const post_id = parseInt(req.params.id, 10);
	const comment_id = parseInt(req.params.comment_id, 10);
	try {
		await service.deleteComment(post_id, comment_id, req.user_id);
		return res.status(200).json({ message: "Comment deleted" });
	} catch (error) {
		return handleError(res, error);
	}
}

module.exports = {
	getPublicFeed,
	createPost,
	getPost,
	updatePost,
	deletePost,
	saveRecipe,
	likePost,
	unlikePost,
	getComments,
	addComment,
	deleteComment,
};
