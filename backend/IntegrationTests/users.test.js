const request = require("supertest");
const app = require("../app");
const sequelize = require("../models/db");

const UsersModel = require("../models/modelInits").users;
const { GOAL_DEFAULTS } = require("../constants/macroDefaults");

const {
	addUserPayload,
	estimateBodyPayload,
	estimateBodyPayloadFemaleCut,
	expectedEstimate,
} = require("./UsersPayloads");

let token;
let userId;

// sync({force:true}) rebuilds every table against the real remote DB - Jest's default 5s hook
// timeout is too tight for that round-trip, so it's extended here (same fix as the other suites).
beforeAll(async () => {
	await sequelize.sync({ force: true });

	const resp = await request(app)
		.post("/auth/register")
		.set("Content-Type", "application/json")
		.send(addUserPayload);

	token = resp.body.accessToken;
	userId = resp.body.userId;
}, 30000);

afterAll(async () => {
	await sequelize.close();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

// ─────────────────────────────────────────────
// GET /users/me
// ─────────────────────────────────────────────

describe("GET /users/me", () => {
	test("requires auth", async () => {
		const resp = await request(app).get("/users/me");
		expect(resp.status).toBe(401);
	});

	test("returns the profile with null goals and default effective goals right after register", async () => {
		const resp = await request(app).get("/users/me").set(auth());

		expect(resp.status).toBe(200);
		const user = resp.body.user;
		expect(user).toBeDefined();

		expect(user.user_id).toBe(userId);
		expect(user.first_name).toBe(addUserPayload.firstName);
		expect(user.last_name).toBe(addUserPayload.lastName);
		expect(user.user_name).toBe(addUserPayload.userName);
		expect(user.created_at).toBeDefined();
		expect(user.password).toBeUndefined();

		expect(user.onboarding_completed).toBe(false);

		// Nothing entered yet
		expect(user.goals).toEqual({
			calories: null,
			protein: null,
			carbs: null,
			fat: null,
			fiber: null,
		});
		expect(user.body).toEqual({
			sex: null,
			birth_date: null,
			height_cm: null,
			weight_kg: null,
			activity_level: null,
			goal_type: null,
		});

		// Falls back to the shared defaults
		expect(user.effective_goals).toEqual(GOAL_DEFAULTS);
	});
});

// ─────────────────────────────────────────────
// PATCH /users/me
// ─────────────────────────────────────────────

describe("PATCH /users/me", () => {
	test("requires auth", async () => {
		const resp = await request(app).patch("/users/me").send({ goals: { calories: 3000 } });
		expect(resp.status).toBe(401);
	});

	test("persists a partial goal override; untouched goals still fall back to defaults", async () => {
		const resp = await request(app)
			.patch("/users/me")
			.set(auth())
			.set("Content-Type", "application/json")
			.send({ goals: { calories: 3000, protein: 210 } });

		expect(resp.status).toBe(200);
		const user = resp.body.user;

		expect(user.goals.calories).toBe(3000);
		expect(user.goals.protein).toBe(210);
		expect(user.goals.carbs).toBeNull();
		expect(user.goals.fat).toBeNull();
		expect(user.goals.fiber).toBeNull();

		expect(user.effective_goals).toEqual({
			...GOAL_DEFAULTS,
			calories: 3000,
			protein: 210,
		});

		// DB check
		const db = await UsersModel.findByPk(userId);
		expect(db.goal_calories).toBe(3000);
		expect(db.goal_protein_g).toBe(210);
		expect(db.goal_carbs_g).toBeNull();
	});

	test("clears a goal when explicitly set to null", async () => {
		const resp = await request(app)
			.patch("/users/me")
			.set(auth())
			.send({ goals: { calories: null } });

		expect(resp.status).toBe(200);
		expect(resp.body.user.goals.calories).toBeNull();
		expect(resp.body.user.effective_goals.calories).toBe(GOAL_DEFAULTS.calories);
		// protein override from the previous test is untouched
		expect(resp.body.user.goals.protein).toBe(210);
	});

	test("persists body metrics and onboarding_completed", async () => {
		const resp = await request(app)
			.patch("/users/me")
			.set(auth())
			.send({
				sex: "male",
				birth_date: "1990-01-01",
				height_cm: 180,
				weight_kg: 80,
				activity_level: "moderate",
				goal_type: "maintain",
				onboarding_completed: true,
			});

		expect(resp.status).toBe(200);
		const user = resp.body.user;
		expect(user.onboarding_completed).toBe(true);
		expect(user.body.sex).toBe("male");
		expect(user.body.birth_date).toBe("1990-01-01");
		expect(Number(user.body.height_cm)).toBe(180);
		expect(Number(user.body.weight_kg)).toBe(80);
		expect(user.body.activity_level).toBe("moderate");
		expect(user.body.goal_type).toBe("maintain");

		// survives a re-fetch
		const get = await request(app).get("/users/me").set(auth());
		expect(get.body.user.onboarding_completed).toBe(true);
		expect(get.body.user.body.activity_level).toBe("moderate");
	});

	test("updates first / last name", async () => {
		const resp = await request(app)
			.patch("/users/me")
			.set(auth())
			.send({ first_name: "Casey Ann", last_name: "Rivers-Lee" });

		expect(resp.status).toBe(200);
		expect(resp.body.user.first_name).toBe("Casey Ann");
		expect(resp.body.user.last_name).toBe("Rivers-Lee");
	});

	test("rejects a negative goal value", async () => {
		const resp = await request(app).patch("/users/me").set(auth()).send({ goals: { calories: -5 } });
		expect(resp.status).toBe(400);
	});

	test("rejects a non-numeric goal value", async () => {
		const resp = await request(app)
			.patch("/users/me")
			.set(auth())
			.send({ goals: { protein: "lots" } });
		expect(resp.status).toBe(400);
	});

	test("rejects an unknown activity_level", async () => {
		const resp = await request(app)
			.patch("/users/me")
			.set(auth())
			.send({ activity_level: "olympian" });
		expect(resp.status).toBe(400);
	});

	test("rejects an unknown sex", async () => {
		const resp = await request(app).patch("/users/me").set(auth()).send({ sex: "yes" });
		expect(resp.status).toBe(400);
	});

	test("rejects a malformed birth_date", async () => {
		const resp = await request(app)
			.patch("/users/me")
			.set(auth())
			.send({ birth_date: "01/01/1990" });
		expect(resp.status).toBe(400);
	});
});

// ─────────────────────────────────────────────
// POST /users/me/goals/estimate
// ─────────────────────────────────────────────

describe("POST /users/me/goals/estimate", () => {
	test("requires auth", async () => {
		const resp = await request(app).post("/users/me/goals/estimate").send(estimateBodyPayload);
		expect(resp.status).toBe(401);
	});

	test("returns a Mifflin–St Jeor estimate without persisting anything", async () => {
		const resp = await request(app)
			.post("/users/me/goals/estimate")
			.set(auth())
			.set("Content-Type", "application/json")
			.send(estimateBodyPayload);

		expect(resp.status).toBe(200);
		const est = resp.body.estimate;
		expect(est).toBeDefined();

		const want = expectedEstimate(estimateBodyPayload);

		// small tolerance for rounding-order differences
		expect(est.bmr).toBeCloseTo(want.bmr, 0);
		expect(est.tdee).toBeCloseTo(want.tdee, 0);
		expect(est.goals.calories).toBeCloseTo(want.goals.calories, -1);
		expect(est.goals.protein).toBe(want.goals.protein);
		expect(est.goals.fat).toBeCloseTo(want.goals.fat, -1);
		expect(est.goals.carbs).toBeCloseTo(want.goals.carbs, -1);
		expect(est.goals.fiber).toBeCloseTo(want.goals.fiber, -1);

		// estimate must NOT have written the goals to the user
		const db = await UsersModel.findByPk(userId);
		expect(db.goal_calories).toBeNull();
	});

	test("handles a female cut estimate", async () => {
		const resp = await request(app)
			.post("/users/me/goals/estimate")
			.set(auth())
			.send(estimateBodyPayloadFemaleCut);

		expect(resp.status).toBe(200);
		const want = expectedEstimate(estimateBodyPayloadFemaleCut);
		expect(resp.body.estimate.goals.calories).toBeCloseTo(want.goals.calories, -1);
	});

	test("400 when a required body field is missing", async () => {
		const { weight_kg, ...incomplete } = estimateBodyPayload;
		const resp = await request(app).post("/users/me/goals/estimate").set(auth()).send(incomplete);
		expect(resp.status).toBe(400);
	});

	test("400 on an unknown goal_type", async () => {
		const resp = await request(app)
			.post("/users/me/goals/estimate")
			.set(auth())
			.send({ ...estimateBodyPayload, goal_type: "bulk_dirty" });
		expect(resp.status).toBe(400);
	});
});
