const request = require("supertest");

// Real Google tokens can't be minted in tests - treat the idToken string as the Google "sub".
jest.mock("../Auth/googleAuth", () => ({
	verifyGoogleIdToken: jest.fn(async (idToken) => ({
		sub: idToken,
		email: `${idToken}@example.com`,
		given_name: "Test",
		family_name: "User",
	})),
}));

const app = require("../app");
const sequelize = require("../models/db");
const { users: UsersModel, workouts: WorkoutsModel } = require("../models/modelInits");

// sync({force:true}) rebuilds every table against the real remote DB - Jest's default 5s hook
// timeout is too tight for that round-trip, so it's extended here (same fix as the other suites).
beforeAll(async () => {
	await sequelize.sync({ force: true });
}, 30000);

afterAll(async () => {
	await sequelize.close();
});

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function createGuest() {
	const resp = await request(app).post("/auth/guest");
	return resp.body; // { userId, accessToken, refreshToken }
}

function addWorkout(user_id) {
	return WorkoutsModel.create({ user_id, name: "Guest workout", workout_date: "2026-09-20" });
}

function upgrade(token, body) {
	return request(app).post("/auth/upgrade-guest/oauth").set(bearer(token)).send(body);
}

describe("POST /auth/upgrade-guest/oauth", () => {
	test("requires auth", async () => {
		const resp = await request(app).post("/auth/upgrade-guest/oauth").send({ provider: "google", idToken: "x" });
		expect(resp.status).toBe(401);
	});

	test("rejects an unknown provider", async () => {
		const guest = await createGuest();
		const resp = await upgrade(guest.accessToken, { provider: "facebook" });
		expect(resp.status).toBe(400);
	});

	test("rejects non-guest accounts", async () => {
		const login = await request(app).post("/auth/google").send({ idToken: "g-already-real" });
		const resp = await upgrade(login.body.accessToken, { provider: "google", idToken: "g-other" });
		expect(resp.status).toBe(403);
	});

	test("case 1: no existing account - the guest row becomes the Google account and keeps its data", async () => {
		const guest = await createGuest();
		await addWorkout(guest.userId);

		const resp = await upgrade(guest.accessToken, { provider: "google", idToken: "g-new" });

		expect(resp.status).toBe(200);
		expect(resp.body.merged).toBe(false);
		expect(resp.body.userId).toBe(guest.userId);
		expect(resp.body.accessToken).toBeDefined();

		const user = await UsersModel.findByPk(guest.userId);
		expect(user.is_guest).toBe(false);
		expect(user.google_user_id).toBe("g-new");
		expect(user.user_name).not.toMatch(/^guest_/);
		expect(await WorkoutsModel.count({ where: { user_id: guest.userId } })).toBe(1);

		// New tokens work
		const valid = await request(app).get("/auth/validToken").set(bearer(resp.body.accessToken));
		expect(valid.status).toBe(200);
		expect(valid.body.isGuest).toBe(false);
	});

	test("case 1: old guest access + refresh tokens stop working after the upgrade", async () => {
		const guest = await createGuest();
		const resp = await upgrade(guest.accessToken, { provider: "google", idToken: "g-revoke" });
		expect(resp.status).toBe(200);

		const oldAccess = await request(app).get("/auth/validToken").set(bearer(guest.accessToken));
		expect(oldAccess.status).toBe(401);

		const oldRefresh = await request(app).post("/auth/refresh").send({ refreshToken: guest.refreshToken });
		expect(oldRefresh.status).toBe(401);
	});

	test("case 2: existing account + guest data - asks first, then merges on confirm", async () => {
		const existing = await request(app).post("/auth/google").send({ idToken: "g-existing" });
		const existingId = existing.body.userId;

		const guest = await createGuest();
		await addWorkout(guest.userId);
		await addWorkout(guest.userId);

		const body = { provider: "google", idToken: "g-existing" };

		// First call only asks - nothing moves yet
		const ask = await upgrade(guest.accessToken, body);
		expect(ask.status).toBe(200);
		expect(ask.body.requiresConfirm).toBe(true);
		expect(ask.body.counts).toEqual({ workouts: 2, diaryEntries: 0, recipes: 0 });
		expect(ask.body.accessToken).toBeUndefined();
		expect(await UsersModel.findByPk(guest.userId)).not.toBeNull();

		// Confirmed - data moves to the existing account and the guest is deleted
		const merged = await upgrade(guest.accessToken, { ...body, confirmed: true });
		expect(merged.status).toBe(200);
		expect(merged.body.merged).toBe(true);
		expect(merged.body.userId).toBe(existingId);

		expect(await WorkoutsModel.count({ where: { user_id: existingId } })).toBe(2);
		expect(await UsersModel.findByPk(guest.userId)).toBeNull();

		// Guest token is dead since the guest row is gone
		const oldAccess = await request(app).get("/auth/validToken").set(bearer(guest.accessToken));
		expect(oldAccess.status).toBe(401);
	});

	test("case 2: existing account + empty guest - merges without asking", async () => {
		const existing = await request(app).post("/auth/google").send({ idToken: "g-existing-empty" });

		const guest = await createGuest();
		const resp = await upgrade(guest.accessToken, { provider: "google", idToken: "g-existing-empty" });

		expect(resp.status).toBe(200);
		expect(resp.body.requiresConfirm).toBeUndefined();
		expect(resp.body.merged).toBe(true);
		expect(resp.body.userId).toBe(existing.body.userId);
		expect(await UsersModel.findByPk(guest.userId)).toBeNull();
	});
});
