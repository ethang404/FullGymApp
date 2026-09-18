const request = require("supertest");
const app = require("../app");
const sequelize = require("../models/db");

const { userAPayload, userBPayload, userCPayload, foodPayload, recipePayload, workoutPayload } = require("./ExplorePayloads");

let tokenA, tokenB, tokenC;
let userIdA, userIdB, userIdC;
let foodId;

// A's content across all three visibilities, plus B's/C's own content, used across the scope/type tests below.
let recipePrivateA, recipeFriendsA, recipePublicA;
let workoutPrivateA, workoutFriendsA, workoutPublicA;
let recipeMineB;
let recipePublicC;

async function createRecipe(token, name, visibility) {
	const resp = await request(app)
		.post("/nutrition/recipes")
		.set("Authorization", `Bearer ${token}`)
		.send(recipePayload(name, visibility, foodId));
	if (resp.status !== 201) throw new Error(`createRecipe(${name}) failed: ${resp.status} ${JSON.stringify(resp.body)}`);
	return resp.body.recipe.recipe_id;
}

async function createWorkout(token, name, visibility) {
	const resp = await request(app).post("/workouts").set("Authorization", `Bearer ${token}`).send(workoutPayload(name, visibility));
	if (resp.status !== 200) throw new Error(`createWorkout(${name}) failed: ${resp.status} ${JSON.stringify(resp.body)}`);
	return resp.body.workout.workout_id;
}

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

	// A and B become friends; C stays unrelated to both.
	const req1 = await request(app).post("/friends/requests").set("Authorization", `Bearer ${tokenA}`).send({ addressee_user_id: userIdB });
	await request(app).post(`/friends/requests/${req1.body.friendship.id}/accept`).set("Authorization", `Bearer ${tokenB}`);

	const food = await request(app).post("/nutrition/foods").set("Authorization", `Bearer ${tokenA}`).send(foodPayload);
	foodId = food.body.food.id;

	recipePrivateA = await createRecipe(tokenA, "A Private Recipe", "private");
	recipeFriendsA = await createRecipe(tokenA, "A Friends Recipe", "friends");
	recipePublicA = await createRecipe(tokenA, "A Public Recipe", "public");

	workoutPrivateA = await createWorkout(tokenA, "A Private Workout", "private");
	workoutFriendsA = await createWorkout(tokenA, "A Friends Workout", "friends");
	workoutPublicA = await createWorkout(tokenA, "A Public Workout", "public");

	recipeMineB = await createRecipe(tokenB, "B Private Recipe", "private");
	recipePublicC = await createRecipe(tokenC, "C Public Recipe", "public");
}, 30000);

afterAll(async () => {
	await sequelize.close();
});

const authA = () => ({ Authorization: `Bearer ${tokenA}` });
const authB = () => ({ Authorization: `Bearer ${tokenB}` });
const authC = () => ({ Authorization: `Bearer ${tokenC}` });

function ids(items) {
	return items.map((i) => `${i.type}:${i.id}`);
}

// ─────────────────────────────────────────────
// GET /explore - validation
// ─────────────────────────────────────────────

describe("GET /explore validation", () => {
	test("requires auth", async () => {
		const resp = await request(app).get("/explore");
		expect(resp.status).toBe(401);
	});

	test("400 on an invalid type", async () => {
		const resp = await request(app).get("/explore?type=snack").set(authA());
		expect(resp.status).toBe(400);
	});

	test("400 on an invalid scope", async () => {
		const resp = await request(app).get("/explore?scope=nowhere").set(authA());
		expect(resp.status).toBe(400);
	});
});

// ─────────────────────────────────────────────
// scope=all (default)
// ─────────────────────────────────────────────

describe("GET /explore default scope (all)", () => {
	test("B (A's friend) sees A's friends+public content, B's own content, not A's private", async () => {
		const resp = await request(app).get("/explore?limit=50").set(authB());
		expect(resp.status).toBe(200);
		const seen = ids(resp.body.items);

		expect(seen).toEqual(expect.arrayContaining([`recipe:${recipeFriendsA}`, `recipe:${recipePublicA}`, `workout:${workoutFriendsA}`, `workout:${workoutPublicA}`, `recipe:${recipeMineB}`]));
		expect(seen).not.toContain(`recipe:${recipePrivateA}`);
		expect(seen).not.toContain(`workout:${workoutPrivateA}`);
	});

	test("C (not A's friend) sees only A's public content, not friends/private", async () => {
		const resp = await request(app).get("/explore?limit=50").set(authC());
		expect(resp.status).toBe(200);
		const seen = ids(resp.body.items);

		expect(seen).toEqual(expect.arrayContaining([`recipe:${recipePublicA}`, `workout:${workoutPublicA}`, `recipe:${recipePublicC}`]));
		expect(seen).not.toContain(`recipe:${recipePrivateA}`);
		expect(seen).not.toContain(`recipe:${recipeFriendsA}`);
		expect(seen).not.toContain(`workout:${workoutPrivateA}`);
		expect(seen).not.toContain(`workout:${workoutFriendsA}`);
	});

	test("each item carries owner display info", async () => {
		const resp = await request(app).get("/explore?limit=50").set(authC());
		const item = resp.body.items.find((i) => i.type === "recipe" && i.id === recipePublicA);
		expect(item.user_id).toBe(userIdA);
		expect(item.user_name).toBe(userAPayload.userName);
	});
});

// ─────────────────────────────────────────────
// scope=mine / public / friends
// ─────────────────────────────────────────────

describe("GET /explore scope filter", () => {
	test("scope=mine returns only the caller's own content, any visibility", async () => {
		const resp = await request(app).get("/explore?scope=mine&limit=50").set(authA());
		expect(resp.status).toBe(200);
		const seen = ids(resp.body.items);

		expect(seen).toEqual(
			expect.arrayContaining([`recipe:${recipePrivateA}`, `recipe:${recipeFriendsA}`, `recipe:${recipePublicA}`, `workout:${workoutPrivateA}`, `workout:${workoutFriendsA}`, `workout:${workoutPublicA}`]),
		);
		expect(resp.body.items.every((i) => i.user_id === userIdA)).toBe(true);
	});

	test("scope=public returns public content from anyone, including the caller's own", async () => {
		const resp = await request(app).get("/explore?scope=public&limit=50").set(authC());
		expect(resp.status).toBe(200);
		const seen = ids(resp.body.items);

		expect(seen).toEqual(expect.arrayContaining([`recipe:${recipePublicA}`, `workout:${workoutPublicA}`, `recipe:${recipePublicC}`]));
		expect(resp.body.items.every((i) => i.visibility === "public")).toBe(true);
	});

	test("scope=friends returns only friends' friends-visible content, not the caller's own or public", async () => {
		const resp = await request(app).get("/explore?scope=friends&limit=50").set(authB());
		expect(resp.status).toBe(200);
		const seen = ids(resp.body.items);

		expect(seen).toEqual(expect.arrayContaining([`recipe:${recipeFriendsA}`, `workout:${workoutFriendsA}`]));
		expect(seen).not.toContain(`recipe:${recipePublicA}`);
		expect(seen).not.toContain(`recipe:${recipeMineB}`);
	});

	test("scope=friends is empty for a user with no accepted friends", async () => {
		const resp = await request(app).get("/explore?scope=friends&limit=50").set(authC());
		expect(resp.status).toBe(200);
		expect(resp.body.items).toEqual([]);
	});
});

// ─────────────────────────────────────────────
// type filter
// ─────────────────────────────────────────────

describe("GET /explore type filter", () => {
	test("type=recipe returns only recipes", async () => {
		const resp = await request(app).get("/explore?type=recipe&scope=public&limit=50").set(authC());
		expect(resp.status).toBe(200);
		expect(resp.body.items.every((i) => i.type === "recipe")).toBe(true);
	});

	test("type=workout returns only workouts", async () => {
		const resp = await request(app).get("/explore?type=workout&scope=public&limit=50").set(authC());
		expect(resp.status).toBe(200);
		expect(resp.body.items.every((i) => i.type === "workout")).toBe(true);
	});
});

// ─────────────────────────────────────────────
// search
// ─────────────────────────────────────────────

describe("GET /explore search", () => {
	test("filters by a case-insensitive name substring", async () => {
		const resp = await request(app).get("/explore?scope=mine&search=friends recipe&limit=50").set(authA());
		expect(resp.status).toBe(200);
		expect(ids(resp.body.items)).toEqual([`recipe:${recipeFriendsA}`]);
	});
});

// ─────────────────────────────────────────────
// pagination
// ─────────────────────────────────────────────

describe("GET /explore pagination", () => {
	const PAGE_ITEM_COUNT = 5;
	let pageWorkoutIds;

	beforeAll(async () => {
		pageWorkoutIds = [];
		for (let i = 1; i <= PAGE_ITEM_COUNT; i++) {
			pageWorkoutIds.push(await createWorkout(tokenA, `PagTest Workout ${i}`, "public"));
		}
	});

	test("walking next_cursor collects every item exactly once, in recency order", async () => {
		const collected = [];
		let cursor;

		for (let guard = 0; guard < 10; guard++) {
			const qs = new URLSearchParams({ type: "workout", scope: "public", search: "PagTest", limit: "2" });
			if (cursor) qs.set("cursor", cursor);

			const resp = await request(app).get(`/explore?${qs.toString()}`).set(authA());
			expect(resp.status).toBe(200);
			expect(resp.body.items.length).toBeLessThanOrEqual(2);

			collected.push(...resp.body.items);
			cursor = resp.body.next_cursor;
			if (!cursor) break;
		}

		expect(collected.length).toBe(PAGE_ITEM_COUNT);
		const collectedIds = collected.map((i) => i.id);
		expect(new Set(collectedIds).size).toBe(PAGE_ITEM_COUNT); // no duplicates across pages
		expect(collectedIds.sort()).toEqual([...pageWorkoutIds].sort());

		// newest-created first
		const timestamps = collected.map((i) => new Date(i.created_at).getTime());
		expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
	});
});
