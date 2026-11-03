const service = require("./service");

// ---------------------------------------------
// Posts
// ---------------------------------------------

// /posts/public?cursor=...&limit=20
async function getPublicFeed(req, res) {
	const { cursor, limit } = req.query;
	const feed = await service.getPublicFeed(req.user_id, { cursor, limit }); //{ posts, next_cursor }
	return res.status(200).json(feed);
}

// Body needs: { visibility, group_id?, workout_id? | recipe_id?, caption? }
async function createPost(req, res) {
	const post = await service.createPost(req.user_id, req.body);
	return res.status(201).json({ post });
}

async function getPost(req, res) {
	const post_id = parseInt(req.params.id, 10);
	const post = await service.getPost(post_id, req.user_id);
	return res.status(200).json({ post });
}

// Body: { caption }
async function updatePost(req, res) {
	const post_id = parseInt(req.params.id, 10);
	const post = await service.updatePost(post_id, req.user_id, req.body);
	return res.status(200).json({ post });
}

async function deletePost(req, res) {
	const post_id = parseInt(req.params.id, 10);
	await service.deletePost(post_id, req.user_id);
	return res.status(200).json({ message: "Post deleted" });
}

async function saveRecipe(req, res) {
	const post_id = parseInt(req.params.id, 10);
	const recipe = await service.saveRecipe(post_id, req.user_id);
	return res.status(201).json({ recipe });
}

// ---------------------------------------------
// Likes
// ---------------------------------------------

async function likePost(req, res) {
	const post_id = parseInt(req.params.id, 10);
	await service.likePost(post_id, req.user_id);
	return res.status(200).json({ message: "Liked" });
}

async function unlikePost(req, res) {
	const post_id = parseInt(req.params.id, 10);
	await service.unlikePost(post_id, req.user_id);
	return res.status(200).json({ message: "Unliked" });
}

// ---------------------------------------------
// Comments
// ---------------------------------------------

// /posts/:id/comments?cursor=...&limit=20
async function getComments(req, res) {
	const post_id = parseInt(req.params.id, 10);
	const { cursor, limit } = req.query;
	const result = await service.getComments(post_id, req.user_id, { cursor, limit }); //{ comments, next_cursor }
	return res.status(200).json(result);
}

// Body needs: { body }
async function addComment(req, res) {
	const post_id = parseInt(req.params.id, 10);
	const { body } = req.body;
	const comment = await service.addComment(post_id, req.user_id, body);
	return res.status(201).json({ comment });
}

async function deleteComment(req, res) {
	const post_id = parseInt(req.params.id, 10);
	const comment_id = parseInt(req.params.comment_id, 10);
	await service.deleteComment(post_id, comment_id, req.user_id);
	return res.status(200).json({ message: "Comment deleted" });
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
