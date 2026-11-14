const {
	posts: postsModel,
	post_comments: postCommentModel,
	post_likes: postLikesModel,
	users: userModel,
	workouts: workoutsModel,
	recipe: recipeModel,
	recipeIngredient: recipeIngredientModel,
	diaryEntries: diaryEntriesModel,
} = require("../models/modelInits");
const sequelize = require("../models/db");
const { NotFoundError, DataError, ForbiddenError } = require("../error");

const { getHiddenUserIds, excludeHiddenUsers } = require("../utils/social");
const { PUBLIC_USER_ATTRIBUTES } = require("../constants");
const { isActiveMember, isGroupManager } = require("../Groups/permissions");
const { paginate } = require("../utils/pagination");
const { cleanText, assertOneOf } = require("../utils/validate");
const WorkoutsService = require("../Workouts/service");
const NutritionService = require("../Nutrition/service");

// Functions Posts/controller.js calls (the acting/viewing user is req.user_id):
//
// getPublicFeed(user_id, { cursor, limit })                     -> { posts, next_cursor }
// createPost(user_id, data)                                     -> post
// getPost(post_id, user_id)                                     -> post (+ attachment)
// updatePost(post_id, user_id, patch)                           -> post
// deletePost(post_id, user_id)
// saveRecipe(post_id, user_id)                                  -> recipe (the new copy)
// likePost(post_id, user_id)
// unlikePost(post_id, user_id)
// getComments(post_id, user_id, { cursor, limit })              -> { comments, next_cursor }
// addComment(post_id, user_id, body)                            -> comment
// deleteComment(post_id, comment_id, user_id)
//
// Also called from other features, so every feed is built in one place:
// getGroupFeed(group_id, user_id, { cursor, limit })            -> { posts, next_cursor }   (Groups/controller.js)
// getUserPosts(target_user_id, user_id, { cursor, limit })      -> { posts, next_cursor }   (Users/controller.js)
// getViewablePost(post_id, user_id, options)                    -> post                     (Reports/service.js)

//author of a post/comment, comes back as .user
//used for showing author alongside the post/comment itself
const AUTHOR_INCLUDE = [{ model: userModel, attributes: PUBLIC_USER_ATTRIBUTES }];

//what a post can share, keyed by the post column that points at it.
//  model/label -> createPost: look it up + check ownership (each one has a user_id)
//  type/load   -> getPost: what the frontend gets as attachment_type, and how to load it for display.
//                 load uses the post's author as owner (same owner-scoped loaders Friends uses)
const ATTACHMENTS = {
	workout_id: {
		model: workoutsModel,
		label: "Workout",
		type: "workout",
		load: (id, owner_id) => WorkoutsService.GetWorkout(id, owner_id),
	},
	recipe_id: {
		model: recipeModel,
		label: "Recipe",
		type: "recipe",
		load: async (id, owner_id) => {
			//recipes are soft deleted - the row stays, so the post shows "no longer available" instead of a 404
			const recipe = await recipeModel.findByPk(id, { attributes: ["is_deleted"] });
			if (!recipe || recipe.is_deleted) return null;
			return NutritionService.getRecipe(id, owner_id);
		},
	},
	diary_log_id: {
		model: diaryEntriesModel,
		label: "Diary entry",
		type: "diary_entry",
		load: async (id, owner_id) => {
			//this one's built for lists, so it returns an array - pull out the single entry
			const [entry] = await NutritionService.fetchAndSerializeDiaryEntries({ id, user_id: owner_id });
			if (!entry) throw new NotFoundError("Diary entry not found");
			return entry;
		},
	},
};

//-----------------------------------------------------------------
//Helper functions
//-----------------------------------------------------------------

//paginate (utils/pagination.js), cleanText (utils/validate.js) and excludeHiddenUsers (utils/social.js) are shared helpers now

async function addCounts(posts, user_id) {
	//for each post, get the counts of likes/comments
	const post_ids = posts.map((post) => post.id);

	const [like_rows, comment_rows, my_likes] = await Promise.all([
		postLikesModel.count({ where: { post_id: post_ids }, group: ["post_id"] }),
		postCommentModel.count({ where: { post_id: post_ids }, group: ["post_id"] }),
		postLikesModel.findAll({ where: { post_id: post_ids, user_id }, attributes: ["post_id"], raw: true }),
	]);

	const like_counts_map = new Map(like_rows.map((r) => [r.post_id, r.count]));
	const comment_counts_map = new Map(comment_rows.map((r) => [r.post_id, r.count]));
	const we_liked_set = new Set(my_likes.map((r) => r.post_id));

	//modify posts to have these counts
	return posts.map((post) => ({
		...post.toJSON(),
		like_count: like_counts_map.get(post.id) ?? 0,
		comment_count: comment_counts_map.get(post.id) ?? 0,
		liked_by_me: we_liked_set.has(post.id),
	}));
}

//Who can see a post (and so anything done through it -- viewing, saving its recipe, ...).
//if post missing, or its author is hidden from us (getViewablePost found no row): 404
//if group post but we're not an active member of group (banned or not in group): 403
//if public post: good
async function assertCanViewPost(post, user_id) {
	if (!post) throw new NotFoundError("Post not found");

	if (post.visibility === "group" && !(await isActiveMember(post.group_id, user_id))) {
		throw new ForbiddenError("You have to be in this group to see this post");
	}
}

//finds a post and makes sure we can see it. options go to findOne (includes etc)
//A hidden author (blocked or banned) means no row comes back, so it's the same 404 as a post that doesn't exist
async function getViewablePost(post_id, user_id, options = {}) {
	const where = await excludeHiddenUsers({ id: post_id }, user_id);
	const post = await postsModel.findOne({ ...options, where });
	await assertCanViewPost(post, user_id);
	return post;
}

//author, or active owner/admin of the post's group
//to determine who can remove a post/comment
async function canModeratePost(post, user_id) {
	if (post.user_id === user_id) return true;
	return post.visibility === "group" && (await isGroupManager(post.group_id, user_id));
}

//-----------------------------------------------------------------
//Functions called from other areas:
//------------------------------------------------------------------
async function getGroupFeed(group_id, user_id, { cursor, limit }) {
	//Note this function shows posts for a group regardless if person still in it or not (old)
	//Check for permissions to post to a group on createPost

	//If we're not active member in group, we can't see
	if (!(await isActiveMember(group_id, user_id))) throw new ForbiddenError("Can't get posts for this group without being in it.");

	const where = await excludeHiddenUsers({ visibility: "group", group_id }, user_id);
	const { rows: posts, next_cursor } = await paginate(postsModel, { where, include: AUTHOR_INCLUDE, cursor, limit });
	return { posts: await addCounts(posts, user_id), next_cursor };
}

async function getUserPosts(target_user_id, user_id, { cursor, limit }) {
	//can't use excludeHiddenUsers here - it would replace the user_id filter below and return everyone's posts
	const hidden_ids = await getHiddenUserIds(user_id);
	if (hidden_ids.includes(target_user_id)) throw new ForbiddenError("We can't find this user's posts");

	const where = { visibility: "public", user_id: target_user_id };
	const { rows: posts, next_cursor } = await paginate(postsModel, { where, include: AUTHOR_INCLUDE, cursor, limit });
	return { posts: await addCounts(posts, user_id), next_cursor };
}

//-----------------------------------------------------------------
//Primary post functions:
//------------------------------------------------------------------

async function getPublicFeed(user_id, { cursor, limit }) {
	const where = await excludeHiddenUsers({ visibility: "public" }, user_id);
	const { rows: posts, next_cursor } = await paginate(postsModel, { where, include: AUTHOR_INCLUDE, cursor, limit });
	return { posts: await addCounts(posts, user_id), next_cursor };
}

// Body: { visibility?, group_id?, workout_id? | recipe_id? | diary_log_id?, caption? }
//also check that only 1 attachment/length of caption. 500 error, but check anyway
async function createPost(user_id, data) {
	const { visibility = "public", group_id = null, caption } = data;

	assertOneOf(visibility, ["public", "group"], "visibility");
	if (visibility === "group" && group_id == null) throw new DataError("group_id is required for group posts");
	if (visibility === "public" && group_id != null) throw new DataError("public posts can't have a group_id");

	//exactly one thing gets shared
	const attached = Object.keys(ATTACHMENTS).filter((key) => data[key] != null);
	if (attached.length !== 1) throw new DataError("A post must share exactly one workout, recipe, or diary entry");
	const attachment_key = attached[0];
	const attachment_id = data[attachment_key];

	if (!Number.isInteger(attachment_id)) throw new DataError(`${attachment_key} must be a number`); //avoids 500 in postgres
	if (group_id != null && !Number.isInteger(group_id)) throw new DataError(`${group_id} must be a number`);

	//caption column is STRING(500) - longer would be a DB error
	const trimmed_caption = cleanText(caption, 500, "caption");

	//group posts: only active members can post
	if (visibility === "group" && !(await isActiveMember(group_id, user_id))) {
		throw new ForbiddenError("You have to be in this group to post to it");
	}

	//you can only share your own stuff and make sure item exits
	const { model, label } = ATTACHMENTS[attachment_key];
	const item = await model.findByPk(attachment_id);
	if (!item || item.is_deleted) throw new NotFoundError(`${label} not found`); //is_deleted only exists on recipes
	if (item.user_id !== user_id) throw new ForbiddenError(`You can only share your own ${label.toLowerCase()}`);

	return postsModel.create({
		user_id,
		visibility,
		group_id,
		[attachment_key]: attachment_id,
		caption: trimmed_caption,
	});
}

//author only, and only the caption can change
async function updatePost(post_id, user_id, patch) {
	const post = await postsModel.findByPk(post_id);
	if (!post) throw new NotFoundError("Post not found");
	if (post.user_id !== user_id) throw new ForbiddenError("You can only edit your own posts");

	const { caption } = patch;
	if (caption === undefined) return post; //nothing sent, nothing to change

	//null or "" clears it. Same 500 char limit as createPost
	return post.update({ caption: cleanText(caption, 500, "caption") });
}

async function getPost(post_id, user_id) {
	//Post + author + whatever it shares + like/comment counts. Comments lists themselves come from getComments (paginated).

	const post = await getViewablePost(post_id, user_id, {
		include: AUTHOR_INCLUDE,
	});

	//only 1 attachment allowed
	//attachment_type tells the frontend which card to draw: "workout" | "recipe" | "diary_entry"
	const attachment_key = Object.keys(ATTACHMENTS).find((key) => post[key] != null);
	const { type: attachment_type, load } = ATTACHMENTS[attachment_key];
	const attachment = await load(post[attachment_key], post.user_id);

	//seperate queries. Get count of likes/comments and the post_likes to see if we liked it
	const [like_count, comment_count, my_like] = await Promise.all([
		postLikesModel.count({ where: { post_id } }),
		postCommentModel.count({ where: { post_id } }),
		postLikesModel.findOne({ where: { post_id, user_id } }),
	]);

	return {
		...post.toJSON(),
		attachment_type,
		attachment, //null when the shared thing was deleted (only recipes - the rest hard delete and take the post with them)
		attachment_status: attachment ? "available" : "unavailable",
		like_count,
		comment_count,
		liked_by_me: my_like !== null,
	};
}

//author can always delete posts
//For Group posts: the group's active owner/admin can too.
async function deletePost(post_id, user_id) {
	const post = await postsModel.findByPk(post_id);
	if (!post) throw new NotFoundError("Post not found");
	if (!(await canModeratePost(post, user_id))) throw new ForbiddenError("You can only delete your own posts");

	await post.destroy();
}

//Copy the recipe a post shares into my own recipes. It's a real copy (no link back), so it survives
//the original being edited or deleted. Saving the same post twice just makes two copies
async function saveRecipe(post_id, user_id) {
	const post = await getViewablePost(post_id, user_id); //can't see the post -> can't save from it

	if (!post.recipe_id) throw new DataError("This post doesn't share a recipe");
	if (post.user_id === user_id) throw new DataError("This recipe is already yours");

	const new_recipe_id = await sequelize.transaction(async (t) => {
		//Get original recipe
		const original = await recipeModel.findByPk(post.recipe_id, {
			include: [{ model: recipeIngredientModel }],
			transaction: t,
		});
		if (!original || original.is_deleted) throw new NotFoundError("This recipe is no longer available");

		//Create new recipe with same details as original but owned by me
		const copy = await recipeModel.create({ user_id, name: original.name, description: original.description, servings: original.servings }, { transaction: t });

		//Grab original ingredients but with new recipe id
		const rows = original.recipeIngredients.map((ing) => ({
			recipe_id: copy.recipe_id,
			food_id: ing.food_id,
			quantity: ing.quantity,
			unit: ing.unit,
			calories: ing.calories,
			protein: ing.protein,
			carbs: ing.carbs,
			fat: ing.fat,
		}));
		await recipeIngredientModel.bulkCreate(rows, { transaction: t });

		return copy.recipe_id;
	}); //return recipe_id to use in getRecipe

	//same shape as GET /nutrition/recipes/:id, now owned by me
	return NutritionService.getRecipe(new_recipe_id, user_id);
}

//idempotent. Add row
async function likePost(post_id, user_id) {
	await getViewablePost(post_id, user_id);
	await postLikesModel.findOrCreate({ where: { post_id, user_id } });
}

//idempotent-remove row
async function unlikePost(post_id, user_id) {
	await postLikesModel.destroy({ where: { post_id, user_id } });
}

//oldest first (reads like a conversation). Next page = comments newer than the cursor
async function getComments(post_id, user_id, { cursor, limit }) {
	await getViewablePost(post_id, user_id);

	const where = await excludeHiddenUsers({ post_id }, user_id);
	const { rows: comments, next_cursor } = await paginate(postCommentModel, {
		where,
		include: AUTHOR_INCLUDE,
		cursor,
		limit,
		newest_first: false,
	});
	return { comments, next_cursor };
}

async function addComment(post_id, user_id, body) {
	const trimmed_body = cleanText(body, 500, "Comment"); //column is STRING(500)
	if (!trimmed_body) throw new DataError("Comment can't be empty");

	await getViewablePost(post_id, user_id);

	const comment = await postCommentModel.create({ post_id, user_id, body: trimmed_body });

	//send it back with the author attached, same shape as getComments
	return postCommentModel.findByPk(comment.id, {
		include: AUTHOR_INCLUDE,
	});
}

//the commenter, the post's author, or (group posts) the group's active owner/admin--for moderation
async function deleteComment(post_id, comment_id, user_id) {
	const comment = await postCommentModel.findOne({ where: { id: comment_id, post_id } });
	if (!comment) throw new NotFoundError("Comment not found");

	if (comment.user_id !== user_id) {
		const post = await postsModel.findByPk(post_id);
		if (!(await canModeratePost(post, user_id))) throw new ForbiddenError("You can't delete this comment");
	}

	await comment.destroy();
}

module.exports = {
	getViewablePost,
	getGroupFeed,
	getPublicFeed,
	getUserPosts,
	createPost,
	updatePost,
	getPost,
	deletePost,
	saveRecipe,
	likePost,
	unlikePost,
	getComments,
	addComment,
	deleteComment,
};
