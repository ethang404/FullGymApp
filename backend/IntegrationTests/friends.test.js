const request = require("supertest");
const app = require("../app");
const sequelize = require("../models/db");

const { userAPayload, userBPayload, userCPayload } = require("./FriendsPayloads");

let tokenA, tokenB, tokenC;
let userIdA, userIdB, userIdC;

let friendshipAB; // A -> B, created pending, later accepted then unfriended
let friendshipAC; // C -> A pending, then A -> C auto-accepts (mutual match)

// sync({force:true}) rebuilds every table against the real remote DB - Jest's default 5s hook
// timeout is too tight for that round-trip, so it's extended here (same fix as the other suites).
beforeAll(async () => {
	await sequelize.sync({ force: true });

	const [respA, respB, respC] = await Promise.all([
		request(app).post("/auth/register").send(userAPayload),
		request(app).post("/auth/register").send(userBPayload),
		request(app).post("/auth/register").send(userCPayload),
	]);

	tokenA = respA.body.accessToken;
	tokenB = respB.body.accessToken;
	tokenC = respC.body.accessToken;
	userIdA = respA.body.userId;
	userIdB = respB.body.userId;
	userIdC = respC.body.userId;
}, 30000);

afterAll(async () => {
	await sequelize.close();
});

const authA = () => ({ Authorization: `Bearer ${tokenA}` });
const authB = () => ({ Authorization: `Bearer ${tokenB}` });
const authC = () => ({ Authorization: `Bearer ${tokenC}` });

// ─────────────────────────────────────────────
// POST /friends/requests
// ─────────────────────────────────────────────

describe("POST /friends/requests", () => {
	test("requires auth", async () => {
		const resp = await request(app).post("/friends/requests").send({ addressee_user_id: userIdB });
		expect(resp.status).toBe(401);
	});

	test("400 when addressee_user_id is missing", async () => {
		const resp = await request(app).post("/friends/requests").set(authA()).send({});
		expect(resp.status).toBe(400);
	});

	test("400 when requesting yourself", async () => {
		const resp = await request(app).post("/friends/requests").set(authA()).send({ addressee_user_id: userIdA });
		expect(resp.status).toBe(400);
	});

	test("404 for a nonexistent user", async () => {
		const resp = await request(app).post("/friends/requests").set(authA()).send({ addressee_user_id: 999999 });
		expect(resp.status).toBe(404);
	});

	test("creates a pending request A -> B", async () => {
		const resp = await request(app).post("/friends/requests").set(authA()).send({ addressee_user_id: userIdB });
		expect(resp.status).toBe(201);
		expect(resp.body.friendship.status).toBe("pending");
		friendshipAB = resp.body.friendship.id;
	});

	test("400 on a duplicate pending request", async () => {
		const resp = await request(app).post("/friends/requests").set(authA()).send({ addressee_user_id: userIdB });
		expect(resp.status).toBe(400);
	});

	test("auto-accepts a mutual request (C -> A pending, then A -> C)", async () => {
		const first = await request(app).post("/friends/requests").set(authC()).send({ addressee_user_id: userIdA });
		expect(first.status).toBe(201);
		expect(first.body.friendship.status).toBe("pending");
		friendshipAC = first.body.friendship.id;

		const second = await request(app).post("/friends/requests").set(authA()).send({ addressee_user_id: userIdC });
		expect(second.status).toBe(200);
		expect(second.body.friendship.id).toBe(friendshipAC); // same row, flipped - not a new one
		expect(second.body.friendship.status).toBe("accepted");
	});
});

// ─────────────────────────────────────────────
// GET /friends/requests
// ─────────────────────────────────────────────

describe("GET /friends/requests", () => {
	test("requires auth", async () => {
		const resp = await request(app).get("/friends/requests?direction=incoming");
		expect(resp.status).toBe(401);
	});

	test("400 on an invalid direction", async () => {
		const resp = await request(app).get("/friends/requests?direction=sideways").set(authA());
		expect(resp.status).toBe(400);
	});

	test("B sees the A -> B request as incoming", async () => {
		const resp = await request(app).get("/friends/requests?direction=incoming").set(authB());
		expect(resp.status).toBe(200);
		expect(resp.body.requests.some((r) => r.friendship_id === friendshipAB && r.user_id === userIdA)).toBe(true);
	});

	test("A sees the A -> B request as outgoing", async () => {
		const resp = await request(app).get("/friends/requests?direction=outgoing").set(authA());
		expect(resp.status).toBe(200);
		expect(resp.body.requests.some((r) => r.friendship_id === friendshipAB && r.user_id === userIdB)).toBe(true);
	});
});

// ─────────────────────────────────────────────
// POST /friends/requests/:id/accept
// ─────────────────────────────────────────────

describe("POST /friends/requests/:id/accept", () => {
	test("requires auth", async () => {
		const resp = await request(app).post(`/friends/requests/${friendshipAB}/accept`);
		expect(resp.status).toBe(401);
	});

	test("404 for a nonexistent request id", async () => {
		const resp = await request(app).post("/friends/requests/999999/accept").set(authB());
		expect(resp.status).toBe(404);
	});

	test("403 when the requester tries to accept their own outgoing request", async () => {
		const resp = await request(app).post(`/friends/requests/${friendshipAB}/accept`).set(authA());
		expect(resp.status).toBe(403);
	});

	test("200 when the addressee accepts", async () => {
		const resp = await request(app).post(`/friends/requests/${friendshipAB}/accept`).set(authB());
		expect(resp.status).toBe(200);
		expect(resp.body.friendship.status).toBe("accepted");
	});

	test("400 when accepting an already-accepted request", async () => {
		const resp = await request(app).post(`/friends/requests/${friendshipAB}/accept`).set(authB());
		expect(resp.status).toBe(400);
	});
});

// ─────────────────────────────────────────────
// GET /friends
// ─────────────────────────────────────────────

describe("GET /friends", () => {
	test("requires auth", async () => {
		const resp = await request(app).get("/friends");
		expect(resp.status).toBe(401);
	});

	test("A's friends list includes both B and C", async () => {
		const resp = await request(app).get("/friends").set(authA());
		expect(resp.status).toBe(200);
		const ids = resp.body.friends.map((f) => f.user_id);
		expect(ids).toEqual(expect.arrayContaining([userIdB, userIdC]));
	});

	test("B's friends list includes A but not C", async () => {
		const resp = await request(app).get("/friends").set(authB());
		expect(resp.status).toBe(200);
		const ids = resp.body.friends.map((f) => f.user_id);
		expect(ids).toContain(userIdA);
		expect(ids).not.toContain(userIdC);
	});
});

// ─────────────────────────────────────────────
// DELETE /friends/requests/:id (decline / cancel a pending request)
// ─────────────────────────────────────────────

describe("DELETE /friends/requests/:id", () => {
	let friendshipBC;

	beforeAll(async () => {
		const resp = await request(app).post("/friends/requests").set(authB()).send({ addressee_user_id: userIdC });
		friendshipBC = resp.body.friendship.id;
	});

	test("requires auth", async () => {
		const resp = await request(app).delete(`/friends/requests/${friendshipBC}`);
		expect(resp.status).toBe(401);
	});

	test("403 when a non-party tries to delete it", async () => {
		const resp = await request(app).delete(`/friends/requests/${friendshipBC}`).set(authA());
		expect(resp.status).toBe(403);
	});

	test("400 when deleting a non-pending (already accepted) friendship via this endpoint", async () => {
		const resp = await request(app).delete(`/friends/requests/${friendshipAB}`).set(authA());
		expect(resp.status).toBe(400);
	});

	test("200 when the addressee declines", async () => {
		const resp = await request(app).delete(`/friends/requests/${friendshipBC}`).set(authC());
		expect(resp.status).toBe(200);

		const check = await request(app).get("/friends/requests?direction=incoming").set(authC());
		expect(check.body.requests.some((r) => r.friendship_id === friendshipBC)).toBe(false);
	});
});

// ─────────────────────────────────────────────
// DELETE /friends/:id (unfriend)
// ─────────────────────────────────────────────

describe("DELETE /friends/:id", () => {
	test("requires auth", async () => {
		const resp = await request(app).delete(`/friends/${friendshipAB}`);
		expect(resp.status).toBe(401);
	});

	test("403 when a non-party tries to unfriend", async () => {
		const resp = await request(app).delete(`/friends/${friendshipAB}`).set(authC());
		expect(resp.status).toBe(403);
	});

	test("400 when the friendship is still pending, not accepted", async () => {
		const pendingResp = await request(app).post("/friends/requests").set(authB()).send({ addressee_user_id: userIdC });
		const pendingId = pendingResp.body.friendship.id;

		const resp = await request(app).delete(`/friends/${pendingId}`).set(authB());
		expect(resp.status).toBe(400);
	});

	test("200 when a party unfriends - removed from both sides' lists", async () => {
		const resp = await request(app).delete(`/friends/${friendshipAB}`).set(authA());
		expect(resp.status).toBe(200);

		const aFriends = await request(app).get("/friends").set(authA());
		expect(aFriends.body.friends.map((f) => f.user_id)).not.toContain(userIdB);

		const bFriends = await request(app).get("/friends").set(authB());
		expect(bFriends.body.friends.map((f) => f.user_id)).not.toContain(userIdA);
	});
});

// ─────────────────────────────────────────────
// GET /friends/search
// ─────────────────────────────────────────────

describe("GET /friends/search", () => {
	test("requires auth", async () => {
		const resp = await request(app).get("/friends/search?query=friends_");
		expect(resp.status).toBe(401);
	});

	test("400 when query is missing", async () => {
		const resp = await request(app).get("/friends/search").set(authA());
		expect(resp.status).toBe(400);
	});

	test("excludes self and annotates relationship state", async () => {
		const resp = await request(app).get("/friends/search?query=friends_").set(authA());
		expect(resp.status).toBe(200);

		const byId = Object.fromEntries(resp.body.results.map((r) => [r.user_id, r]));
		expect(byId[userIdA]).toBeUndefined(); // never includes self

		// A and B were unfriended in the previous describe block
		expect(byId[userIdB].relationship).toBe("none");
		// A and C are still friends (mutual-match auto-accept earlier)
		expect(byId[userIdC].relationship).toBe("friends");
	});
});
