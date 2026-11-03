const request = require("supertest");
const sequelize = require("../models/db");
const {
	friendships: FriendshipsModel,
	blocked_users: BlockedModel,
	groups: GroupsModel,
	group_members: MembersModel,
	posts: PostsModel,
	users: UsersModel,
} = require("../models/modelInits");
const { app, registerUser, createGuest, bearer, createWorkout, makeFriends, createGroup, tick } = require("./SocialHelpers");

// sync({force:true}) rebuilds every table - extended timeout, same as the other suites
beforeAll(async () => {
	await sequelize.sync({ force: true });
}, 30000);

afterAll(async () => {
	await sequelize.close();
});

const block = (from, to) => request(app).post(`/users/${to.id}/block`).set(bearer(from));
const search = (user, q) => request(app).get(`/users/search?q=${encodeURIComponent(q)}`).set(bearer(user));

// ─────────────────────────────────────────────
// GET /users/search
// ─────────────────────────────────────────────

describe("GET /users/search", () => {
	let me;
	let jordan;

	beforeAll(async () => {
		me = await registerUser("searcher");
		jordan = await registerUser("jordan");
	});

	test("matches username, only public fields, never myself", async () => {
		const resp = await search(me, "jordan");
		expect(resp.status).toBe(200);
		expect(resp.body.users.map((u) => u.user_id)).toContain(jordan.id);
		expect(Object.keys(resp.body.users[0]).sort()).toEqual(["first_name", "last_name", "user_id", "user_name"]);

		const self = await search(me, "searcher");
		expect(self.body.users.map((u) => u.user_id)).not.toContain(me.id);
	});

	test("case-insensitive, and matches first name too", async () => {
		const resp = await search(me, "JORD");
		expect(resp.body.users.map((u) => u.user_id)).toContain(jordan.id);
	});

	test("empty query -> empty list", async () => {
		const resp = await search(me, "   ");
		expect(resp.status).toBe(200);
		expect(resp.body.users).toEqual([]);
	});

	test("hides people I blocked and people who blocked me", async () => {
		const blocked_by_me = await registerUser("hidden");
		const blocker_of_me = await registerUser("hidden");
		await block(me, blocked_by_me);
		await block(blocker_of_me, me);

		const resp = await search(me, "hidden");
		const ids = resp.body.users.map((u) => u.user_id);
		expect(ids).not.toContain(blocked_by_me.id);
		expect(ids).not.toContain(blocker_of_me.id);
	});

	test("guests can't search -> 403", async () => {
		const guest = await createGuest();
		const resp = await search(guest, "jordan");
		expect(resp.status).toBe(403);
	});
});

// ─────────────────────────────────────────────
// Blocking
// ─────────────────────────────────────────────

describe("Blocking", () => {
	test("block removes any friendship between us", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		await makeFriends(alice, bob);

		const resp = await block(alice, bob);
		expect(resp.status).toBe(200);

		const a = Math.min(alice.id, bob.id);
		const b = Math.max(alice.id, bob.id);
		expect(await FriendshipsModel.count({ where: { user_id_a: a, user_id_b: b } })).toBe(0);
	});

	test("block also removes a pending request", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		await request(app).post("/friends/requests").set(bearer(bob)).send({ user_id: alice.id });

		await block(alice, bob);
		const pending = await request(app).get("/friends/requests").set(bearer(bob));
		expect(pending.body.requests.outgoing).toHaveLength(0);
	});

	test("blocking twice is a no-op, not an error", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		expect((await block(alice, bob)).status).toBe(200);
		expect((await block(alice, bob)).status).toBe(200);
		expect(await BlockedModel.count({ where: { blocker_id: alice.id, blocked_user_id: bob.id } })).toBe(1);
	});

	test("blocking yourself -> 400, unknown user -> 404, non-numeric id -> 400", async () => {
		const alice = await registerUser("alice");
		expect((await block(alice, alice)).status).toBe(400);
		expect((await request(app).post("/users/999999/block").set(bearer(alice))).status).toBe(404);
		expect((await request(app).post("/users/abc/block").set(bearer(alice))).status).toBe(400);
	});

	test("block list shows only people I blocked, newest first, never who blocked me", async () => {
		const alice = await registerUser("alice");
		const first = await registerUser("first");
		const second = await registerUser("second");
		const blocker = await registerUser("blocker");

		await block(alice, first);
		await tick();
		await block(alice, second);
		await block(blocker, alice);

		const resp = await request(app).get("/users/me/blocks").set(bearer(alice));
		expect(resp.status).toBe(200);
		expect(resp.body.users.map((u) => u.user_id)).toEqual([second.id, first.id]);
		expect(resp.body.users[0].blocked_at).toBeDefined();
		expect(resp.body.users[0].password).toBeUndefined();
	});

	test("unblock removes only MY block - theirs stays", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		await block(alice, bob);
		await block(bob, alice);

		const resp = await request(app).delete(`/users/${bob.id}/block`).set(bearer(alice));
		expect(resp.status).toBe(200);
		expect(await BlockedModel.count({ where: { blocker_id: alice.id, blocked_user_id: bob.id } })).toBe(0);
		expect(await BlockedModel.count({ where: { blocker_id: bob.id, blocked_user_id: alice.id } })).toBe(1);
	});

	test("unblocking someone you never blocked is a no-op", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		const resp = await request(app).delete(`/users/${bob.id}/block`).set(bearer(alice));
		expect(resp.status).toBe(200);
	});
});

// ─────────────────────────────────────────────
// DELETE /users/me with social data
// ─────────────────────────────────────────────

describe("DELETE /users/me - social data + group handoff", () => {
	const deleteMe = (user) => request(app).delete("/users/me").set(bearer(user));
	const join = (user, group) => request(app).post(`/groups/${group.id}/join`).set(bearer(user));

	test("a user with a friendship, a block, a group membership and a post can be deleted", async () => {
		const doomed = await registerUser("doomed");
		const friend = await registerUser("friend");
		const owner = await registerUser("owner");
		await makeFriends(doomed, friend);
		await block(doomed, owner);

		const group = await createGroup(friend);
		await join(doomed, group);
		const workout = await createWorkout(doomed);
		await request(app).post("/posts").set(bearer(doomed)).send({ workout_id: workout.workout_id });

		const resp = await deleteMe(doomed);
		expect(resp.status).toBe(200);
		expect(await UsersModel.findByPk(doomed.id)).toBeNull();
		expect(await BlockedModel.count({ where: { blocker_id: doomed.id } })).toBe(0);
		expect(await MembersModel.count({ where: { user_id: doomed.id } })).toBe(0);
		expect(await PostsModel.count({ where: { user_id: doomed.id } })).toBe(0);

		//the other people are fine
		expect((await request(app).get("/friends").set(bearer(friend))).body.friends).toHaveLength(0);
	});

	test("owned group goes to an admin before an older member", async () => {
		const owner = await registerUser("owner");
		const old_member = await registerUser("oldmember");
		const newer_admin = await registerUser("newadmin");
		const group = await createGroup(owner);

		await join(old_member, group);
		await tick();
		await join(newer_admin, group);
		await request(app).patch(`/groups/${group.id}/members/${newer_admin.id}`).set(bearer(owner)).send({ role: "admin" });

		await deleteMe(owner);

		const promoted = await MembersModel.findOne({ where: { group_id: group.id, user_id: newer_admin.id } });
		expect(promoted.role).toBe("owner");
		const untouched = await MembersModel.findOne({ where: { group_id: group.id, user_id: old_member.id } });
		expect(untouched.role).toBe("member");
	});

	test("no admins -> the oldest active member becomes owner (not pending/banned people)", async () => {
		const owner = await registerUser("owner");
		const pending = await registerUser("pending");
		const oldest = await registerUser("oldest");
		const newer = await registerUser("newer");
		const group = await createGroup(owner, { join_policy: "request" });

		await join(pending, group); //stays pending
		await tick();
		await join(oldest, group);
		await request(app).post(`/groups/${group.id}/requests/${oldest.id}/approve`).set(bearer(owner));
		await tick();
		await join(newer, group);
		await request(app).post(`/groups/${group.id}/requests/${newer.id}/approve`).set(bearer(owner));

		await deleteMe(owner);

		const owners = await MembersModel.findAll({ where: { group_id: group.id, role: "owner" } });
		expect(owners.map((m) => m.user_id)).toEqual([oldest.id]);
	});

	test("a group where I was the only member is deleted", async () => {
		const owner = await registerUser("owner");
		const group = await createGroup(owner, { name: "Solo club" });

		await deleteMe(owner);
		expect(await GroupsModel.findByPk(group.id)).toBeNull();
	});

	test("a group I'm only a member of is left alone", async () => {
		const owner = await registerUser("owner");
		const member = await registerUser("member");
		const group = await createGroup(owner);
		await join(member, group);

		await deleteMe(member);

		const owner_row = await MembersModel.findOne({ where: { group_id: group.id, user_id: owner.id } });
		expect(owner_row.role).toBe("owner");
		expect(await GroupsModel.findByPk(group.id)).not.toBeNull();
	});
});
