const request = require("supertest");
const sequelize = require("../models/db");
const {
	posts: PostsModel,
	post_likes: LikesModel,
	post_comments: CommentsModel,
	recipe: RecipeModel,
	recipeIngredient: RecipeIngredientModel,
	food: FoodModel,
	diaryEntries: DiaryEntriesModel,
	blocked_users: BlockedModel,
} = require("../models/modelInits");
const { app, registerUser, bearer, createWorkout, createRecipe, createGroup, tick } = require("./SocialHelpers");

// sync({force:true}) rebuilds every table - extended timeout, same as the other suites
beforeAll(async () => {
	await sequelize.sync({ force: true });
}, 30000);

afterAll(async () => {
	await sequelize.close();
});

const createPost = (user, body) => request(app).post("/posts").set(bearer(user)).send(body);
const getPost = (user, post) => request(app).get(`/posts/${post.id}`).set(bearer(user));
const join = (user, group) => request(app).post(`/groups/${group.id}/join`).set(bearer(user));
const like = (user, post) => request(app).post(`/posts/${post.id}/like`).set(bearer(user));
const comment = (user, post, body) => request(app).post(`/posts/${post.id}/comments`).set(bearer(user)).send({ body });

//public post sharing a fresh workout of the author's
async function publicPost(user, caption = "PR day") {
	const workout = await createWorkout(user);
	const resp = await createPost(user, { workout_id: workout.workout_id, caption });
	return resp.body.post;
}

//group with owner + an active member, and a post by the member in it
async function groupWithPost() {
	const owner = await registerUser("gowner");
	const member = await registerUser("gmember");
	const group = await createGroup(owner);
	await join(member, group);
	const workout = await createWorkout(member);
	const resp = await createPost(member, { visibility: "group", group_id: group.id, workout_id: workout.workout_id });
	return { owner, member, group, post: resp.body.post };
}

// ─────────────────────────────────────────────
// POST /posts
// ─────────────────────────────────────────────

describe("POST /posts", () => {
	test("public post sharing my workout; visibility defaults to public, caption is trimmed", async () => {
		const user = await registerUser("poster");
		const workout = await createWorkout(user);

		const resp = await createPost(user, { workout_id: workout.workout_id, caption: "  Leg day  " });
		expect(resp.status).toBe(201);
		expect(resp.body.post.visibility).toBe("public");
		expect(resp.body.post.user_id).toBe(user.id);
		expect(resp.body.post.workout_id).toBe(workout.workout_id);
		expect(resp.body.post.caption).toBe("Leg day");
	});

	test("posting someone else's workout -> 403, a workout that doesn't exist -> 404", async () => {
		const user = await registerUser("poster");
		const other = await registerUser("other");
		const their_workout = await createWorkout(other);

		expect((await createPost(user, { workout_id: their_workout.workout_id })).status).toBe(403);
		expect((await createPost(user, { workout_id: 999999 })).status).toBe(404);
	});

	test("exactly one attachment, as a number", async () => {
		const user = await registerUser("poster");
		const workout = await createWorkout(user);
		const recipe = await createRecipe(user);

		expect((await createPost(user, {})).status).toBe(400);
		expect((await createPost(user, { workout_id: workout.workout_id, recipe_id: recipe.recipe_id })).status).toBe(400);
		expect((await createPost(user, { workout_id: "abc" })).status).toBe(400);
	});

	test("visibility / group_id combos are validated", async () => {
		const user = await registerUser("poster");
		const workout = await createWorkout(user);
		const group = await createGroup(user);

		expect((await createPost(user, { visibility: "friends", workout_id: workout.workout_id })).status).toBe(400);
		expect((await createPost(user, { visibility: "group", workout_id: workout.workout_id })).status).toBe(400);
		expect((await createPost(user, { visibility: "public", group_id: group.id, workout_id: workout.workout_id })).status).toBe(400);
	});

	test("caption over 500 characters -> 400", async () => {
		const user = await registerUser("poster");
		const workout = await createWorkout(user);
		const resp = await createPost(user, { workout_id: workout.workout_id, caption: "x".repeat(501) });
		expect(resp.status).toBe(400);
	});

	test("posting to a group I'm not in -> 403; as an active member -> 201", async () => {
		const owner = await registerUser("owner");
		const outsider = await registerUser("outsider");
		const group = await createGroup(owner);
		const workout = await createWorkout(outsider);

		const denied = await createPost(outsider, { visibility: "group", group_id: group.id, workout_id: workout.workout_id });
		expect(denied.status).toBe(403);

		await join(outsider, group);
		const allowed = await createPost(outsider, { visibility: "group", group_id: group.id, workout_id: workout.workout_id });
		expect(allowed.status).toBe(201);
	});
});

// ─────────────────────────────────────────────
// GET /posts/:id
// ─────────────────────────────────────────────

describe("GET /posts/:id", () => {
	test("workout post: author, attachment in the editor shape, counts", async () => {
		const author = await registerUser("author");
		const viewer = await registerUser("viewer");
		const post = await publicPost(author);
		await like(viewer, post);
		await comment(viewer, post, "Nice");

		const resp = await getPost(viewer, post);
		expect(resp.status).toBe(200);
		const got = resp.body.post;
		expect(got.user.user_id).toBe(author.id);
		expect(got.user.password).toBeUndefined();
		expect(got.attachment_type).toBe("workout");
		expect(got.attachment.workout_name).toBe("Push day");
		expect(got.like_count).toBe(1);
		expect(got.comment_count).toBe(1);
		expect(got.liked_by_me).toBe(true);

		const as_author = await getPost(author, post);
		expect(as_author.body.post.liked_by_me).toBe(false);
	});

	test("recipe post -> attachment_type recipe", async () => {
		const author = await registerUser("author");
		const recipe = await createRecipe(author);
		const created = await createPost(author, { recipe_id: recipe.recipe_id });

		const resp = await getPost(author, created.body.post);
		expect(resp.body.post.attachment_type).toBe("recipe");
		expect(resp.body.post.attachment.name).toBe("Chili");
	});

	test("diary post -> attachment_type diary_entry", async () => {
		const author = await registerUser("author");
		const food = await FoodModel.create({ name: "Oats", source: "user_submitted" });
		const entry = await DiaryEntriesModel.create({ user_id: author.id, food_id: food.id, meal_type: "breakfast", logged_at: "2026-10-01", quantity: 50, unit: "g" });
		const created = await createPost(author, { diary_log_id: entry.id });

		const resp = await getPost(author, created.body.post);
		expect(resp.status).toBe(200);
		expect(resp.body.post.attachment_type).toBe("diary_entry");
		expect(resp.body.post.attachment.food.name).toBe("Oats");
	});

	test("unknown post -> 404; blocked with the author -> 404", async () => {
		const author = await registerUser("author");
		const blocked = await registerUser("blocked");
		const post = await publicPost(author);
		await BlockedModel.create({ blocker_id: author.id, blocked_user_id: blocked.id });

		expect((await request(app).get("/posts/999999").set(bearer(blocked))).status).toBe(404);
		expect((await getPost(blocked, post)).status).toBe(404);
	});

	test("group post: non-member -> 403, member -> 200", async () => {
		const { owner, post } = await groupWithPost();
		const outsider = await registerUser("outsider");

		expect((await getPost(outsider, post)).status).toBe(403);
		expect((await getPost(owner, post)).status).toBe(200);
	});
});

// ─────────────────────────────────────────────
// Feeds + pagination
// ─────────────────────────────────────────────

describe("Feeds", () => {
	test("public feed: author + counts on each post, no group posts, newest first", async () => {
		const author = await registerUser("feedauthor");
		const viewer = await registerUser("feedviewer");
		const post = await publicPost(author, "Feed me");
		await like(viewer, post);
		const { post: group_post } = await groupWithPost();

		const resp = await request(app).get("/posts/public?limit=100").set(bearer(viewer));
		expect(resp.status).toBe(200);
		const ids = resp.body.posts.map((p) => p.id);
		expect(ids).toContain(post.id);
		expect(ids).not.toContain(group_post.id);

		const mine = resp.body.posts.find((p) => p.id === post.id);
		expect(mine.user.user_name).toBe(author.userName);
		expect(mine.like_count).toBe(1);
		expect(mine.comment_count).toBe(0);
		expect(mine.liked_by_me).toBe(true);

		const times = resp.body.posts.map((p) => new Date(p.createdAt).getTime());
		expect([...times].sort((a, b) => b - a)).toEqual(times);
	});

	test("public feed hides authors I'm blocked with, either direction", async () => {
		const viewer = await registerUser("viewer");
		const i_blocked = await registerUser("iblocked");
		const blocked_me = await registerUser("blockedme");
		const p1 = await publicPost(i_blocked);
		const p2 = await publicPost(blocked_me);
		await BlockedModel.create({ blocker_id: viewer.id, blocked_user_id: i_blocked.id });
		await BlockedModel.create({ blocker_id: blocked_me.id, blocked_user_id: viewer.id });

		const resp = await request(app).get("/posts/public?limit=100").set(bearer(viewer));
		const ids = resp.body.posts.map((p) => p.id);
		expect(ids).not.toContain(p1.id);
		expect(ids).not.toContain(p2.id);
	});

	test("user posts: paging through with the cursor returns every post once, newest first", async () => {
		const author = await registerUser("pager");
		const viewer = await registerUser("viewer");
		const created = [];
		for (let i = 0; i < 5; i++) {
			created.push(await publicPost(author, `post ${i}`));
			await tick();
		}

		const seen = [];
		let cursor = null;
		let pages = 0;
		do {
			const url = `/users/${author.id}/posts?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
			const resp = await request(app).get(url).set(bearer(viewer));
			expect(resp.status).toBe(200);
			seen.push(...resp.body.posts.map((p) => p.id));
			cursor = resp.body.next_cursor;
			pages += 1;
		} while (cursor && pages < 10);

		expect(pages).toBe(3);
		expect(seen).toEqual(created.map((p) => p.id).reverse());
	});

	test("user posts: only that user's public posts; blocked -> 403", async () => {
		const author = await registerUser("author");
		const other = await registerUser("other");
		const viewer = await registerUser("viewer");
		const post = await publicPost(author);
		await publicPost(other);

		const resp = await request(app).get(`/users/${author.id}/posts`).set(bearer(viewer));
		expect(resp.body.posts.map((p) => p.id)).toEqual([post.id]);

		await BlockedModel.create({ blocker_id: author.id, blocked_user_id: viewer.id });
		expect((await request(app).get(`/users/${author.id}/posts`).set(bearer(viewer))).status).toBe(403);
	});

	test("bad cursor -> 400; bad limits fall back instead of erroring", async () => {
		const viewer = await registerUser("viewer");
		await publicPost(viewer);

		expect((await request(app).get("/posts/public?cursor=not-a-date").set(bearer(viewer))).status).toBe(400);

		const negative = await request(app).get("/posts/public?limit=-5").set(bearer(viewer));
		expect(negative.status).toBe(200);
		expect(negative.body.posts).toHaveLength(1);

		const junk = await request(app).get("/posts/public?limit=abc").set(bearer(viewer));
		expect(junk.status).toBe(200);
	});

	test("group feed: members only, only that group's posts", async () => {
		const { owner, group, post } = await groupWithPost();
		const { post: other_group_post } = await groupWithPost();
		const outsider = await registerUser("outsider");

		expect((await request(app).get(`/groups/${group.id}/posts`).set(bearer(outsider))).status).toBe(403);

		const resp = await request(app).get(`/groups/${group.id}/posts`).set(bearer(owner));
		expect(resp.status).toBe(200);
		expect(resp.body.posts.map((p) => p.id)).toEqual([post.id]);
		expect(resp.body.posts.map((p) => p.id)).not.toContain(other_group_post.id);
		expect(resp.body.posts[0].like_count).toBe(0);
	});
});

// ─────────────────────────────────────────────
// Edit / delete
// ─────────────────────────────────────────────

describe("PATCH + DELETE /posts/:id", () => {
	test("author edits the caption only; empty clears it; others get 403", async () => {
		const author = await registerUser("author");
		const other = await registerUser("other");
		const post = await publicPost(author);

		const edited = await request(app).patch(`/posts/${post.id}`).set(bearer(author)).send({ caption: "Edited", visibility: "group" });
		expect(edited.status).toBe(200);
		expect(edited.body.post.caption).toBe("Edited");
		expect(edited.body.post.visibility).toBe("public");

		const cleared = await request(app).patch(`/posts/${post.id}`).set(bearer(author)).send({ caption: "" });
		expect(cleared.body.post.caption).toBeNull();

		expect((await request(app).patch(`/posts/${post.id}`).set(bearer(other)).send({ caption: "Hacked" })).status).toBe(403);
		expect((await request(app).patch(`/posts/${post.id}`).set(bearer(author)).send({ caption: "x".repeat(501) })).status).toBe(400);
	});

	test("random user can't delete; author can, and likes + comments go with it", async () => {
		const author = await registerUser("author");
		const other = await registerUser("other");
		const post = await publicPost(author);
		await like(other, post);
		await comment(other, post, "hi");

		expect((await request(app).delete(`/posts/${post.id}`).set(bearer(other))).status).toBe(403);
		expect((await request(app).delete(`/posts/${post.id}`).set(bearer(author))).status).toBe(200);
		expect(await PostsModel.findByPk(post.id)).toBeNull();
		expect(await LikesModel.count({ where: { post_id: post.id } })).toBe(0);
		expect(await CommentsModel.count({ where: { post_id: post.id } })).toBe(0);
	});

	test("group owner/admin can delete a member's group post", async () => {
		const { owner, post } = await groupWithPost();
		expect((await request(app).delete(`/posts/${post.id}`).set(bearer(owner))).status).toBe(200);
	});
});

// ─────────────────────────────────────────────
// Save recipe
// ─────────────────────────────────────────────

describe("POST /posts/:id/save-recipe", () => {
	test("copies the recipe + ingredients into my account, and the copy survives the original being deleted", async () => {
		const author = await registerUser("chef");
		const saver = await registerUser("saver");
		const food = await FoodModel.create({ name: "Beans", source: "user_submitted" });
		const recipe = await createRecipe(author);
		await RecipeIngredientModel.create({ recipe_id: recipe.recipe_id, food_id: food.id, quantity: 100, unit: "g", calories: 120, protein: 8, carbs: 20, fat: 1 });
		const created = await createPost(author, { recipe_id: recipe.recipe_id });

		const resp = await request(app).post(`/posts/${created.body.post.id}/save-recipe`).set(bearer(saver));
		expect(resp.status).toBe(201);
		const copy_id = resp.body.recipe.recipe_id;
		expect(copy_id).not.toBe(recipe.recipe_id);
		expect(resp.body.recipe.user_id).toBe(saver.id);
		expect(resp.body.recipe.name).toBe("Chili");
		expect(resp.body.recipe.ingredients).toHaveLength(1);

		await RecipeModel.destroy({ where: { recipe_id: recipe.recipe_id } });
		expect(await RecipeModel.findByPk(copy_id)).not.toBeNull();
		expect(await RecipeIngredientModel.count({ where: { recipe_id: copy_id } })).toBe(1);
	});

	test("saving my own recipe -> 400; a post that isn't a recipe -> 400", async () => {
		const author = await registerUser("chef");
		const recipe = await createRecipe(author);
		const created = await createPost(author, { recipe_id: recipe.recipe_id });
		const workout_post = await publicPost(author);
		const other = await registerUser("other");

		expect((await request(app).post(`/posts/${created.body.post.id}/save-recipe`).set(bearer(author))).status).toBe(400);
		expect((await request(app).post(`/posts/${workout_post.id}/save-recipe`).set(bearer(other))).status).toBe(400);
	});

	test("can't save from a post I can't see -> 403", async () => {
		const owner = await registerUser("owner");
		const member = await registerUser("member");
		const outsider = await registerUser("outsider");
		const group = await createGroup(owner);
		await join(member, group);
		const recipe = await createRecipe(member);
		const created = await createPost(member, { visibility: "group", group_id: group.id, recipe_id: recipe.recipe_id });

		const resp = await request(app).post(`/posts/${created.body.post.id}/save-recipe`).set(bearer(outsider));
		expect(resp.status).toBe(403);
	});
});

// ─────────────────────────────────────────────
// Likes
// ─────────────────────────────────────────────

describe("Likes", () => {
	test("liking twice is fine and counts once; unlike removes it; unliking again is fine", async () => {
		const author = await registerUser("author");
		const fan = await registerUser("fan");
		const post = await publicPost(author);

		expect((await like(fan, post)).status).toBe(200);
		expect((await like(fan, post)).status).toBe(200);
		expect(await LikesModel.count({ where: { post_id: post.id } })).toBe(1);

		expect((await request(app).delete(`/posts/${post.id}/like`).set(bearer(fan))).status).toBe(200);
		expect((await request(app).delete(`/posts/${post.id}/like`).set(bearer(fan))).status).toBe(200);
		expect(await LikesModel.count({ where: { post_id: post.id } })).toBe(0);
	});

	test("someone who can't see the post can't like it", async () => {
		const { post } = await groupWithPost();
		const outsider = await registerUser("outsider");
		expect((await like(outsider, post)).status).toBe(403);
		expect((await request(app).post("/posts/999999/like").set(bearer(outsider))).status).toBe(404);
	});
});

// ─────────────────────────────────────────────
// Comments
// ─────────────────────────────────────────────

describe("Comments", () => {
	test("add returns the comment with its author; empty or too long -> 400", async () => {
		const author = await registerUser("author");
		const commenter = await registerUser("commenter");
		const post = await publicPost(author);

		const resp = await comment(commenter, post, "  Great work  ");
		expect(resp.status).toBe(201);
		expect(resp.body.comment.body).toBe("Great work");
		expect(resp.body.comment.user.user_id).toBe(commenter.id);

		expect((await comment(commenter, post, "   ")).status).toBe(400);
		expect((await comment(commenter, post, "x".repeat(501))).status).toBe(400);
	});

	test("list is oldest first and pages forward with the cursor", async () => {
		const author = await registerUser("author");
		const post = await publicPost(author);
		for (const text of ["first", "second", "third"]) {
			await comment(author, post, text);
			await tick();
		}

		const page1 = await request(app).get(`/posts/${post.id}/comments?limit=2`).set(bearer(author));
		expect(page1.body.comments.map((c) => c.body)).toEqual(["first", "second"]);
		expect(page1.body.next_cursor).not.toBeNull();

		const page2 = await request(app)
			.get(`/posts/${post.id}/comments?limit=2&cursor=${encodeURIComponent(page1.body.next_cursor)}`)
			.set(bearer(author));
		expect(page2.body.comments.map((c) => c.body)).toEqual(["third"]);
		expect(page2.body.next_cursor).toBeNull();
	});

	test("comments from people I'm blocked with are hidden", async () => {
		const author = await registerUser("author");
		const viewer = await registerUser("viewer");
		const troll = await registerUser("troll");
		const post = await publicPost(author);
		await comment(troll, post, "rude");
		await comment(author, post, "thanks all");
		await BlockedModel.create({ blocker_id: viewer.id, blocked_user_id: troll.id });

		const resp = await request(app).get(`/posts/${post.id}/comments`).set(bearer(viewer));
		expect(resp.body.comments.map((c) => c.body)).toEqual(["thanks all"]);
	});

	test("can't read or add comments on a post I can't see", async () => {
		const { post } = await groupWithPost();
		const outsider = await registerUser("outsider");
		expect((await request(app).get(`/posts/${post.id}/comments`).set(bearer(outsider))).status).toBe(403);
		expect((await comment(outsider, post, "let me in")).status).toBe(403);
	});

	test("delete: commenter and post author can, random user can't, wrong post id -> 404", async () => {
		const author = await registerUser("author");
		const commenter = await registerUser("commenter");
		const random = await registerUser("random");
		const post = await publicPost(author);
		const other_post = await publicPost(author);
		const c1 = (await comment(commenter, post, "one")).body.comment;
		const c2 = (await comment(commenter, post, "two")).body.comment;

		const del = (user, p, c) => request(app).delete(`/posts/${p.id}/comments/${c.id}`).set(bearer(user));

		expect((await del(random, post, c1)).status).toBe(403);
		expect((await del(commenter, other_post, c1)).status).toBe(404);
		expect((await del(commenter, post, c1)).status).toBe(200);
		expect((await del(author, post, c2)).status).toBe(200);
	});

	test("group admin can delete comments on group posts", async () => {
		const { owner, member, post } = await groupWithPost();
		const c = (await comment(member, post, "hello")).body.comment;
		const resp = await request(app).delete(`/posts/${post.id}/comments/${c.id}`).set(bearer(owner));
		expect(resp.status).toBe(200);
	});
});
