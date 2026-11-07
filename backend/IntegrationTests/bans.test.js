const request = require("supertest");

//the idToken string doubles as the provider's user id, same as guestUpgrade.test.js
jest.mock("../Auth/googleAuth", () => ({
	verifyGoogleIdToken: jest.fn(async (idToken) => ({ sub: idToken, email: `${idToken}@example.com`, given_name: "Test", family_name: "User" })),
}));
jest.mock("../Auth/appleAuth", () => ({
	//nonce is the hash of the raw "nonce" the Apple test sends. require is inline because jest.mock runs before the imports
	verifyAppleIdentityToken: jest.fn(async (identityToken) => ({
		sub: identityToken,
		nonce: require("crypto").createHash("sha256").update("nonce").digest("hex"),
	})),
	exchangeAppleAuthorizationCode: jest.fn(async () => null),
	revokeAppleToken: jest.fn(async () => {}),
}));

const sequelize = require("../models/db");
const { users: UsersModel, reports: ReportsModel, posts: PostsModel } = require("../models/modelInits");
const { app, registerUser, createGuest, bearer, createWorkout, createGroup } = require("./SocialHelpers");

const PASSWORD = "SocialTest123!"; //what registerUser signs everyone up with
const SUSPENDED = "This account has been suspended";

let admin;

// sync({force:true}) rebuilds every table - extended timeout, same as the other suites
beforeAll(async () => {
	await sequelize.sync({ force: true });
	admin = await registerUser("admin");
	process.env.ADMIN_USER_IDS = `${admin.id}`;
}, 30000);

afterAll(async () => {
	delete process.env.ADMIN_USER_IDS;
	await sequelize.close();
});

const setBanned = (actor, user_id, is_banned) => request(app).patch(`/admin/users/${user_id}`).set(bearer(actor)).send({ is_banned });
const ban = (user) => setBanned(admin, user.id, true);
const login = (user, password = PASSWORD) => request(app).post("/auth/login").send({ userName: user.userName, password });
const getMe = (user) => request(app).get("/users/me").set(bearer(user));

async function publicPost(user) {
	const workout = await createWorkout(user);
	const resp = await request(app).post("/posts").set(bearer(user)).send({ workout_id: workout.workout_id, caption: "PR day" });
	return resp.body.post;
}

// ─────────────────────────────────────────────
// PATCH /admin/users/:id
// ─────────────────────────────────────────────

describe("PATCH /admin/users/:id", () => {
	test("true bans, false unbans", async () => {
		const target = await registerUser("target");

		const banned = await setBanned(admin, target.id, true);
		expect(banned.status).toBe(200);
		expect(banned.body.message).toBe("User banned");
		expect((await UsersModel.findByPk(target.id)).is_banned).toBe(true);

		const unbanned = await setBanned(admin, target.id, false);
		expect(unbanned.status).toBe(200);
		expect(unbanned.body.message).toBe("User unbanned");
		expect((await UsersModel.findByPk(target.id)).is_banned).toBe(false);
	});

	test("anything but a real boolean -> 400 and nothing changes", async () => {
		const target = await registerUser("target");

		expect((await setBanned(admin, target.id, "false")).status).toBe(400);
		expect((await setBanned(admin, target.id, 1)).status).toBe(400);
		expect((await setBanned(admin, target.id, null)).status).toBe(400);
		expect((await request(app).patch(`/admin/users/${target.id}`).set(bearer(admin))).status).toBe(400);

		expect((await UsersModel.findByPk(target.id)).is_banned).toBe(false);
	});

	test("banning twice is fine", async () => {
		const target = await registerUser("target");

		await ban(target);
		expect((await ban(target)).status).toBe(200);
	});

	test("not an admin -> 403 and nobody gets banned", async () => {
		const user = await registerUser("user");
		const target = await registerUser("target");

		expect((await setBanned(user, target.id, true)).status).toBe(403);
		expect((await UsersModel.findByPk(target.id)).is_banned).toBe(false);
	});

	test("no token -> 401", async () => {
		expect((await request(app).patch("/admin/users/1").send({ is_banned: true })).status).toBe(401);
	});

	test("unknown user -> 404, bad id -> 400", async () => {
		expect((await setBanned(admin, 999999, true)).status).toBe(404);
		expect((await setBanned(admin, "abc", true)).status).toBe(400);
	});

	test("can't ban yourself -> 400", async () => {
		expect((await setBanned(admin, admin.id, true)).status).toBe(400);
		expect((await getMe(admin)).status).toBe(200);
	});

	test("only flips the column: their posts and reports aren't touched", async () => {
		const target = await registerUser("target");
		const reporter = await registerUser("reporter");
		const post = await publicPost(target);
		await request(app).post("/reports").set(bearer(reporter)).send({ target_type: "post", target_id: post.id, reason: "spam" });

		await ban(target);

		expect(await PostsModel.findByPk(post.id)).not.toBeNull();
		const row = await ReportsModel.findOne({ where: { reporter_id: reporter.id, target_type: "post", target_id: post.id } });
		expect(row.status).toBe("open");
	});
});

// ─────────────────────────────────────────────
// A banned account is locked out
// ─────────────────────────────────────────────

describe("a banned user", () => {
	test("their access token stops working on the next request", async () => {
		const target = await registerUser("target");
		expect((await getMe(target)).status).toBe(200);

		await ban(target);

		expect((await getMe(target)).status).toBe(401);
	});

	test("a guest's never-expiring token stops working too", async () => {
		const guest = await createGuest();

		await ban(guest);

		expect((await getMe(guest)).status).toBe(401);
	});

	test("their refresh token gets a 401, so the app signs them out", async () => {
		const target = await registerUser("target");
		const session = await login(target);

		await ban(target);

		const resp = await request(app).post("/auth/refresh").send({ refreshToken: session.body.refreshToken });
		expect(resp.status).toBe(401);
	});

	test("password login -> 403 with the message, and no tokens", async () => {
		const target = await registerUser("target");
		await ban(target);

		const resp = await login(target);
		expect(resp.status).toBe(403);
		expect(resp.body.message).toBe(SUSPENDED);
		expect(resp.body.accessToken).toBeUndefined();
	});

	test("the wrong password gets the normal error, so strangers can't tell who's banned", async () => {
		const target = await registerUser("target");
		await ban(target);

		const resp = await login(target, "WrongPassword123!");
		expect(resp.status).toBe(401);
		expect(resp.body.message).not.toBe(SUSPENDED);
	});

	test("Google sign-in -> 403 with the message, and no tokens", async () => {
		const first = await request(app).post("/auth/google").send({ idToken: "g-banned" });
		await setBanned(admin, first.body.userId, true);

		const resp = await request(app).post("/auth/google").send({ idToken: "g-banned" });
		expect(resp.status).toBe(403);
		expect(resp.body.message).toBe(SUSPENDED);
		expect(resp.body.accessToken).toBeUndefined();
	});

	test("Apple sign-in -> 403 with the message, and no tokens", async () => {
		const body = { identityToken: "a-banned", nonce: "nonce" };
		const first = await request(app).post("/auth/apple").send(body);
		await setBanned(admin, first.body.userId, true);

		const resp = await request(app).post("/auth/apple").send(body);
		expect(resp.status).toBe(403);
		expect(resp.body.message).toBe(SUSPENDED);
		expect(resp.body.accessToken).toBeUndefined();
	});

	test("isn't in user search", async () => {
		const searcher = await registerUser("searcher");
		const target = await registerUser("findme");
		const search = () => request(app).get(`/users/search?q=${target.userName}`).set(bearer(searcher));

		expect((await search()).body.users).toHaveLength(1);

		await ban(target);

		expect((await search()).body.users).toHaveLength(0);
	});

	test("can't be sent a friend request -> 404", async () => {
		const sender = await registerUser("sender");
		const target = await registerUser("target");
		await ban(target);

		const resp = await request(app).post("/friends/requests").set(bearer(sender)).send({ user_id: target.id });
		expect(resp.status).toBe(404);
	});

	test("can't be invited to a group -> 404", async () => {
		const owner = await registerUser("owner");
		const target = await registerUser("target");
		const group = await createGroup(owner);
		await ban(target);

		const resp = await request(app).post(`/groups/${group.id}/invites`).set(bearer(owner)).send({ user_id: target.id });
		expect(resp.status).toBe(404);
	});
});

// ─────────────────────────────────────────────
// A banned user's content is hidden from everyone
// ─────────────────────────────────────────────

describe("a banned user's content", () => {
	const feedIds = async (viewer) => {
		const resp = await request(app).get("/posts/public?limit=100").set(bearer(viewer));
		return resp.body.posts.map((post) => post.id);
	};
	const viewPost = (viewer, post) => request(app).get(`/posts/${post.id}`).set(bearer(viewer));
	const profile = (viewer, user) => request(app).get(`/users/${user.id}/posts`).set(bearer(viewer));

	test("isn't in the public feed", async () => {
		const target = await registerUser("target");
		const viewer = await registerUser("viewer");
		const post = await publicPost(target);
		expect(await feedIds(viewer)).toContain(post.id);

		await ban(target);

		expect(await feedIds(viewer)).not.toContain(post.id);
	});

	test("isn't in a group feed", async () => {
		const owner = await registerUser("owner");
		const target = await registerUser("target");
		const group = await createGroup(owner);
		await request(app).post(`/groups/${group.id}/join`).set(bearer(target));
		const workout = await createWorkout(target);
		const created = await request(app)
			.post("/posts")
			.set(bearer(target))
			.send({ visibility: "group", group_id: group.id, workout_id: workout.workout_id });

		await ban(target);

		const resp = await request(app).get(`/groups/${group.id}/posts`).set(bearer(owner));
		expect(resp.body.posts.map((post) => post.id)).not.toContain(created.body.post.id);
	});

	test("viewing, liking or commenting on their post by id -> 404", async () => {
		const target = await registerUser("target");
		const viewer = await registerUser("viewer");
		const post = await publicPost(target);
		expect((await viewPost(viewer, post)).status).toBe(200);

		await ban(target);

		expect((await viewPost(viewer, post)).status).toBe(404);
		expect((await request(app).post(`/posts/${post.id}/like`).set(bearer(viewer))).status).toBe(404);
		expect((await request(app).post(`/posts/${post.id}/comments`).set(bearer(viewer)).send({ body: "hi" })).status).toBe(404);
	});

	test("their comment disappears from someone else's post, and that post stays up", async () => {
		const author = await registerUser("author");
		const target = await registerUser("target");
		const post = await publicPost(author);
		await request(app).post(`/posts/${post.id}/comments`).set(bearer(target)).send({ body: "rude" });

		await ban(target);

		const resp = await request(app).get(`/posts/${post.id}/comments`).set(bearer(author));
		expect(resp.status).toBe(200);
		expect(resp.body.comments).toHaveLength(0);
	});

	test("their profile's posts -> 403", async () => {
		const target = await registerUser("target");
		const viewer = await registerUser("viewer");
		await publicPost(target);

		await ban(target);

		expect((await profile(viewer, target)).status).toBe(403);
	});

	test("someone else's profile still only shows that person's posts", async () => {
		const target = await registerUser("target");
		const viewer = await registerUser("viewer");
		const friend = await registerUser("friend");
		const other = await registerUser("other");
		const post = await publicPost(friend);
		await publicPost(other);

		await ban(target); //makes sure the hidden list isn't empty

		const resp = await profile(viewer, friend);
		expect(resp.status).toBe(200);
		expect(resp.body.posts.map((row) => row.id)).toEqual([post.id]);
	});

	test("blocks work the same as before", async () => {
		const author = await registerUser("author");
		const viewer = await registerUser("viewer");
		const post = await publicPost(author);
		await request(app).post(`/users/${author.id}/block`).set(bearer(viewer));

		expect((await viewPost(viewer, post)).status).toBe(404);
		expect((await profile(viewer, author)).status).toBe(403);
	});

	test("an author can still see their own post", async () => {
		const author = await registerUser("author");
		const post = await publicPost(author);

		expect((await viewPost(author, post)).status).toBe(200);
	});

	test("you can't report a post you can't see", async () => {
		const target = await registerUser("target");
		const reporter = await registerUser("reporter");
		const post = await publicPost(target);

		await ban(target);

		const resp = await request(app).post("/reports").set(bearer(reporter)).send({ target_type: "post", target_id: post.id, reason: "spam" });
		expect(resp.status).toBe(404);
	});
});

// ─────────────────────────────────────────────
// Unbanning undoes all of it
// ─────────────────────────────────────────────

describe("an unbanned user", () => {
	test("gets back in with their old token and a new login", async () => {
		const target = await registerUser("target");
		await ban(target);

		await setBanned(admin, target.id, false);

		expect((await getMe(target)).status).toBe(200);
		expect((await login(target)).status).toBe(200);
	});

	test("their posts and comments come back", async () => {
		const target = await registerUser("target");
		const viewer = await registerUser("viewer");
		const post = await publicPost(target);
		await request(app).post(`/posts/${post.id}/comments`).set(bearer(target)).send({ body: "still here" });
		await ban(target);

		await setBanned(admin, target.id, false);

		expect((await request(app).get(`/posts/${post.id}`).set(bearer(viewer))).status).toBe(200);
		const comments = await request(app).get(`/posts/${post.id}/comments`).set(bearer(viewer));
		expect(comments.body.comments).toHaveLength(1);
		expect((await request(app).get(`/users/${target.id}/posts`).set(bearer(viewer))).body.posts).toHaveLength(1);
	});
});
