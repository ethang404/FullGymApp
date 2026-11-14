const request = require("supertest");
const sequelize = require("../models/db");
const { group_members: MembersModel, groups: GroupsModel, blocked_users: BlockedModel } = require("../models/modelInits");
const { app, registerUser, createGuest, bearer, createGroup } = require("./SocialHelpers");

// sync({force:true}) rebuilds every table - extended timeout, same as the other suites
beforeAll(async () => {
	await sequelize.sync({ force: true });
}, 30000);

afterAll(async () => {
	await sequelize.close();
});

const join = (user, group) => request(app).post(`/groups/${group.id}/join`).set(bearer(user));
const invite = (from, group, to) => request(app).post(`/groups/${group.id}/invites`).set(bearer(from)).send({ user_id: to.id });
const setRole = (from, group, target, role) =>
	request(app).patch(`/groups/${group.id}/members/${target.id}`).set(bearer(from)).send({ role });
const remove = (from, group, target, ban = false) =>
	request(app).delete(`/groups/${group.id}/members/${target.id}${ban ? "?ban=true" : ""}`).set(bearer(from));
const membership = (group, user) => MembersModel.findOne({ where: { group_id: group.id, user_id: user.id } });

//owner + an admin + a member, all active. Built as open so they can join, then switched to the policy asked for
async function groupWithRoles({ join_policy = "open", ...data } = {}) {
	const owner = await registerUser("owner");
	const admin = await registerUser("admin");
	const member = await registerUser("member");
	const group = await createGroup(owner, { ...data, join_policy: "open" });
	await join(admin, group);
	await join(member, group);
	await setRole(owner, group, admin, "admin");
	if (join_policy !== "open") await request(app).patch(`/groups/${group.id}`).set(bearer(owner)).send({ join_policy });
	return { group, owner, admin, member };
}

// ─────────────────────────────────────────────
// Create / view / edit / delete
// ─────────────────────────────────────────────

describe("Groups CRUD", () => {
	test("guests can't use groups", async () => {
		const guest = await createGuest();
		const resp = await request(app).get("/groups/mine").set(bearer(guest));
		expect(resp.status).toBe(403);
	});

	test("create -> creator is the active owner, created_by is set", async () => {
		const owner = await registerUser("owner");
		const resp = await request(app).post("/groups").set(bearer(owner)).send({ name: "  Morning Lifters  ", join_policy: "request" });
		expect(resp.status).toBe(201);
		expect(resp.body.group.name).toBe("Morning Lifters");
		expect(resp.body.group.created_by).toBe(owner.id);

		const row = await membership(resp.body.group, owner);
		expect(row.role).toBe("owner");
		expect(row.status).toBe("active");
	});

	test("join_policy defaults to open", async () => {
		const owner = await registerUser("owner");
		const resp = await request(app).post("/groups").set(bearer(owner)).send({ name: "Default" });
		expect(resp.body.group.join_policy).toBe("open");
	});

	test("missing name or bad join_policy -> 400 (not a DB 500)", async () => {
		const owner = await registerUser("owner");
		expect((await request(app).post("/groups").set(bearer(owner)).send({ name: "   " })).status).toBe(400);
		expect((await request(app).post("/groups").set(bearer(owner)).send({ name: "X", join_policy: "secret" })).status).toBe(400);
	});

	test("getGroup shows member_count + my role/status, null when I'm not in it", async () => {
		const { group, owner } = await groupWithRoles();
		const outsider = await registerUser("outsider");

		const mine = await request(app).get(`/groups/${group.id}`).set(bearer(owner));
		expect(mine.status).toBe(200);
		expect(mine.body.group.member_count).toBe(3);
		expect(mine.body.group.my_role).toBe("owner");
		expect(mine.body.group.my_status).toBe("active");

		const theirs = await request(app).get(`/groups/${group.id}`).set(bearer(outsider));
		expect(theirs.body.group.my_role).toBeNull();
		expect(theirs.body.group.my_status).toBeNull();
	});

	test("unknown group -> 404", async () => {
		const user = await registerUser("user");
		expect((await request(app).get("/groups/999999").set(bearer(user))).status).toBe(404);
	});

	test("owner and admin can edit, member can't", async () => {
		const { group, admin, member } = await groupWithRoles();

		const by_admin = await request(app).patch(`/groups/${group.id}`).set(bearer(admin)).send({ description: "New desc" });
		expect(by_admin.status).toBe(200);
		expect(by_admin.body.group.description).toBe("New desc");

		const by_member = await request(app).patch(`/groups/${group.id}`).set(bearer(member)).send({ description: "Nope" });
		expect(by_member.status).toBe(403);
	});

	test("edit validates name + join_policy", async () => {
		const { group, owner } = await groupWithRoles();
		expect((await request(app).patch(`/groups/${group.id}`).set(bearer(owner)).send({ name: "" })).status).toBe(400);
		expect((await request(app).patch(`/groups/${group.id}`).set(bearer(owner)).send({ join_policy: "nope" })).status).toBe(400);
	});

	test("non-string or over-255-char names are a 400, not a 500", async () => {
		const { group, owner } = await groupWithRoles();
		expect((await request(app).post("/groups").set(bearer(owner)).send({ name: 123 })).status).toBe(400);
		expect((await request(app).post("/groups").set(bearer(owner)).send({ name: "x".repeat(256) })).status).toBe(400);
		expect((await request(app).patch(`/groups/${group.id}`).set(bearer(owner)).send({ name: 123 })).status).toBe(400);
		expect((await request(app).patch(`/groups/${group.id}`).set(bearer(owner)).send({ name: "x".repeat(256) })).status).toBe(400);
	});

	test("only the owner can delete; memberships go with it", async () => {
		const { group, owner, admin } = await groupWithRoles();

		expect((await request(app).delete(`/groups/${group.id}`).set(bearer(admin))).status).toBe(403);
		expect((await request(app).delete(`/groups/${group.id}`).set(bearer(owner))).status).toBe(200);
		expect(await GroupsModel.findByPk(group.id)).toBeNull();
		expect(await MembersModel.count({ where: { group_id: group.id } })).toBe(0);
	});
});

// ─────────────────────────────────────────────
// Joining (each join policy) + invites + requests
// ─────────────────────────────────────────────

describe("Join policies", () => {
	test("open -> active right away", async () => {
		const owner = await registerUser("owner");
		const user = await registerUser("user");
		const group = await createGroup(owner, { join_policy: "open" });

		const resp = await join(user, group);
		expect(resp.status).toBe(201);
		expect(resp.body.membership.status).toBe("active");
	});

	test("request -> pending, then an admin approves", async () => {
		const { group, admin } = await groupWithRoles({ join_policy: "request" });
		const user = await registerUser("user");

		const resp = await join(user, group);
		expect(resp.body.membership.status).toBe("pending");

		const approved = await request(app).post(`/groups/${group.id}/requests/${user.id}/approve`).set(bearer(admin));
		expect(approved.status).toBe(200);
		expect(approved.body.membership.status).toBe("active");
	});

	test("a regular member can't approve requests", async () => {
		const { group, member } = await groupWithRoles({ join_policy: "request" });
		const user = await registerUser("user");
		await join(user, group);

		const resp = await request(app).post(`/groups/${group.id}/requests/${user.id}/approve`).set(bearer(member));
		expect(resp.status).toBe(403);
	});

	test("approving someone with no pending request -> 404", async () => {
		const { group, owner, member } = await groupWithRoles({ join_policy: "request" });
		const resp = await request(app).post(`/groups/${group.id}/requests/${member.id}/approve`).set(bearer(owner));
		expect(resp.status).toBe(404);
	});

	test("invite_only -> join is 403 without an invite", async () => {
		const owner = await registerUser("owner");
		const user = await registerUser("user");
		const group = await createGroup(owner, { join_policy: "invite_only" });

		expect((await join(user, group)).status).toBe(403);
	});

	test("already active / already pending -> 409", async () => {
		const owner = await registerUser("owner");
		const user = await registerUser("user");
		const open = await createGroup(owner, { join_policy: "open" });
		const req = await createGroup(owner, { join_policy: "request" });

		await join(user, open);
		expect((await join(user, open)).status).toBe(409);
		await join(user, req);
		expect((await join(user, req)).status).toBe(409);
	});

	test("invite -> accept", async () => {
		const owner = await registerUser("owner");
		const user = await registerUser("user");
		const group = await createGroup(owner, { join_policy: "invite_only" });

		const invited = await invite(owner, group, user);
		expect(invited.status).toBe(201);
		expect(invited.body.membership.status).toBe("invited");
		expect(invited.body.membership.invited_by).toBe(owner.id);

		const accepted = await request(app).post(`/groups/${group.id}/invites/accept`).set(bearer(user));
		expect(accepted.status).toBe(200);
		expect(accepted.body.membership.status).toBe("active");
	});

	test("joining while invited counts as accepting (even invite_only)", async () => {
		const owner = await registerUser("owner");
		const user = await registerUser("user");
		const group = await createGroup(owner, { join_policy: "invite_only" });
		await invite(owner, group, user);

		const resp = await join(user, group);
		expect(resp.body.membership.status).toBe("active");
	});

	test("inviting someone who already requested just approves them", async () => {
		const owner = await registerUser("owner");
		const user = await registerUser("user");
		const group = await createGroup(owner, { join_policy: "request" });
		await join(user, group);

		const resp = await invite(owner, group, user);
		expect(resp.body.membership.status).toBe("active");
	});

	test("accepting with no invite -> 404", async () => {
		const owner = await registerUser("owner");
		const user = await registerUser("user");
		const group = await createGroup(owner);
		const resp = await request(app).post(`/groups/${group.id}/invites/accept`).set(bearer(user));
		expect(resp.status).toBe(404);
	});

	test("invite rules: members can't invite, no self-invite, no blocked users, no duplicates", async () => {
		const { group, owner, member } = await groupWithRoles({ join_policy: "invite_only" });
		const user = await registerUser("user");
		const blocked = await registerUser("blocked");
		await BlockedModel.create({ blocker_id: blocked.id, blocked_user_id: owner.id });

		expect((await invite(member, group, user)).status).toBe(403);
		expect((await invite(owner, group, owner)).status).toBe(400);
		expect((await invite(owner, group, blocked)).status).toBe(403);
		expect((await invite(owner, group, member)).status).toBe(409);

		await invite(owner, group, user);
		expect((await invite(owner, group, user)).status).toBe(409);
	});

	test("inviting a guest or unknown user -> 404", async () => {
		const owner = await registerUser("owner");
		const guest = await createGuest();
		const group = await createGroup(owner);

		expect((await invite(owner, group, guest)).status).toBe(404);
		expect((await request(app).post(`/groups/${group.id}/invites`).set(bearer(owner)).send({ user_id: 999999 })).status).toBe(404);
	});
});

// ─────────────────────────────────────────────
// Members, roles, kicks, bans, leaving, transfer
// ─────────────────────────────────────────────

describe("Members + moderation", () => {
	test("member list: everyone sees active members (owner, admin, member order); managers also see pending", async () => {
		const { group, owner, admin, member } = await groupWithRoles({ join_policy: "request" });
		const pending = await registerUser("pending");
		await join(pending, group);

		const as_member = await request(app).get(`/groups/${group.id}/members`).set(bearer(member));
		expect(as_member.status).toBe(200);
		expect(as_member.body.members.map((m) => m.user_id)).toEqual([owner.id, admin.id, member.id]);
		expect(as_member.body.members[0].password).toBeUndefined();

		const as_admin = await request(app).get(`/groups/${group.id}/members`).set(bearer(admin));
		expect(as_admin.body.members.map((m) => m.user_id)).toContain(pending.id);
	});

	test("only the owner changes roles, only member <-> admin", async () => {
		const { group, owner, admin, member } = await groupWithRoles();

		expect((await setRole(admin, group, member, "admin")).status).toBe(403);
		expect((await setRole(owner, group, member, "owner")).status).toBe(400);
		expect((await setRole(owner, group, member, "superuser")).status).toBe(400);
		expect((await setRole(owner, group, owner, "member")).status).toBe(400);

		const promoted = await setRole(owner, group, member, "admin");
		expect(promoted.status).toBe(200);
		expect(promoted.body.membership.role).toBe("admin");
	});

	test("rank: admin kicks a member, but can't remove another admin or the owner", async () => {
		const { group, owner, admin, member } = await groupWithRoles();
		const admin2 = await registerUser("admin2");
		await join(admin2, group);
		await setRole(owner, group, admin2, "admin");

		expect((await remove(admin, group, admin2)).status).toBe(403);
		expect((await remove(admin, group, owner)).status).toBe(403);

		expect((await remove(admin, group, member)).status).toBe(200);
		expect(await membership(group, member)).toBeNull();
	});

	test("owner can remove an admin; a member can't remove anyone", async () => {
		const { group, owner, admin, member } = await groupWithRoles();

		expect((await remove(member, group, admin)).status).toBe(403);
		expect((await remove(owner, group, admin)).status).toBe(200);
	});

	test("kick (no ban) -> they can rejoin an open group", async () => {
		const { group, owner, member } = await groupWithRoles();
		await remove(owner, group, member);
		expect((await join(member, group)).status).toBe(201);
	});

	test("ban -> group is hidden from them (404), can't rejoin, doesn't show in search", async () => {
		const { group, owner, member } = await groupWithRoles({ name: "Bannable Crew" });

		const resp = await remove(owner, group, member, true);
		expect(resp.status).toBe(200);
		const row = await membership(group, member);
		expect(row.status).toBe("banned");
		expect(row.role).toBe("member");

		expect((await request(app).get(`/groups/${group.id}`).set(bearer(member))).status).toBe(404);
		expect((await join(member, group)).status).toBe(404);
		expect((await request(app).get(`/groups/${group.id}/members`).set(bearer(member))).status).toBe(404);

		const found = await request(app).get("/groups?search=bannable").set(bearer(member));
		expect(found.body.groups.map((g) => g.id)).not.toContain(group.id);
	});

	test("banning a banned user -> 409; removing a banned row = unban", async () => {
		const { group, owner, member } = await groupWithRoles();
		await remove(owner, group, member, true);

		expect((await remove(owner, group, member, true)).status).toBe(409);
		expect((await remove(owner, group, member)).status).toBe(200);
		expect((await join(member, group)).status).toBe(201);
	});

	test("a banned user can't remove their own ban row", async () => {
		const { group, owner, member } = await groupWithRoles();
		await remove(owner, group, member, true);

		expect((await remove(member, group, member)).status).toBe(404);
		expect((await membership(group, member)).status).toBe("banned");
	});

	test("leave / decline / cancel all work on yourself; can't ban yourself", async () => {
		const { group, member } = await groupWithRoles();
		expect((await remove(member, group, member, true)).status).toBe(400);
		expect((await remove(member, group, member)).status).toBe(200);
		expect(await membership(group, member)).toBeNull();
	});

	test("owner can't leave without transferring first", async () => {
		const { group, owner } = await groupWithRoles();
		expect((await remove(owner, group, owner)).status).toBe(403);
	});

	test("transfer ownership: new owner must be active, old owner becomes admin", async () => {
		const { group, owner, admin, member } = await groupWithRoles({ join_policy: "request" });
		const pending = await registerUser("pending");
		await join(pending, group);

		const transfer = (from, to) => request(app).post(`/groups/${group.id}/transfer-ownership`).set(bearer(from)).send({ user_id: to.id });

		expect((await transfer(admin, member)).status).toBe(403);
		expect((await transfer(owner, pending)).status).toBe(400);
		expect((await transfer(owner, owner)).status).toBe(400);

		const resp = await transfer(owner, member);
		expect(resp.status).toBe(200);
		expect(resp.body.group.my_role).toBe("admin");
		expect((await membership(group, member)).role).toBe("owner");

		//old owner can leave now
		expect((await remove(owner, group, owner)).status).toBe(200);
		expect((await membership(group, admin)).role).toBe("admin");
	});
});

// ─────────────────────────────────────────────
// My groups + search
// ─────────────────────────────────────────────

describe("My groups + search", () => {
	test("mine splits active vs invited, flattened role/status, pending + banned left out", async () => {
		const owner = await registerUser("owner");
		const me = await registerUser("me");
		const active = await createGroup(owner, { name: "Active one" });
		const invited = await createGroup(owner, { name: "Invited one", join_policy: "invite_only" });
		const pending = await createGroup(owner, { name: "Pending one", join_policy: "request" });
		const banned = await createGroup(owner, { name: "Banned one" });

		await join(me, active);
		await invite(owner, invited, me);
		await join(me, pending);
		await join(me, banned);
		await remove(owner, banned, me, true);

		const resp = await request(app).get("/groups/mine").set(bearer(me));
		expect(resp.status).toBe(200);
		expect(resp.body.groups.active.map((g) => g.id)).toEqual([active.id]);
		expect(resp.body.groups.invited.map((g) => g.id)).toEqual([invited.id]);
		expect(resp.body.groups.active[0].role).toBe("member");
		expect(resp.body.groups.active[0].status).toBe("active");
		expect(resp.body.groups.active[0].group_members).toBeUndefined();
	});

	test("search: case-insensitive, flattened my_role/my_status, empty query -> []", async () => {
		const owner = await registerUser("owner");
		const me = await registerUser("me");
		const mine = await createGroup(owner, { name: "Zebra Squats" });
		const other = await createGroup(owner, { name: "zebra runners" });
		await join(me, mine);

		const resp = await request(app).get("/groups?search=ZEBRA").set(bearer(me));
		expect(resp.status).toBe(200);
		const by_id = Object.fromEntries(resp.body.groups.map((g) => [g.id, g]));
		expect(by_id[mine.id].my_status).toBe("active");
		expect(by_id[mine.id].my_role).toBe("member");
		expect(by_id[other.id].my_status).toBeNull();
		expect(by_id[mine.id].memberships).toBeUndefined();

		const empty = await request(app).get("/groups").set(bearer(me));
		expect(empty.body.groups).toEqual([]);
	});
});
