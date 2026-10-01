const request = require("supertest");
const app = require("../app");
const sequelize = require("../models/db");

const ExerciseCatalogModel = require("../models/modelInits").exercise_catalog;

let token;
let otherToken;
const catalog = {};

// Progress endpoints filter relative to "now", so fixture dates are generated relative to today
// instead of hardcoded (a hardcoded date would drift out of the week/month windows).
function daysAgo(days) {
	const d = new Date();
	d.setDate(d.getDate() - days);
	return d.toISOString().slice(0, 10);
}

const RECENT = daysAgo(3); // inside week + month + year
const EARLIER = daysAgo(12); // inside month + year, outside week
const OLD = daysAgo(60); // inside year only

const working = (order_number, reps, weight) => ({ order_number, set_type: "working", notes: "", reps, weight });

function workoutPayload(workout_date, exercises) {
	return { workout_name: "Session", workout_date, notes: "", finished_at: `${workout_date}T15:30:00Z`, exercises };
}

// e1RM = weight × (1 + reps / 30) on the day's best working set
const e1rm = (weight, reps) => weight * (1 + reps / 30);

beforeAll(async () => {
	await sequelize.sync({ force: true });

	let resp = await request(app)
		.post("/auth/register")
		.set("Content-Type", "application/json")
		.send({ firstName: "Pro", lastName: "Gress", userName: "progress_tester", password: "passy" });
	token = resp.body.accessToken;

	resp = await request(app)
		.post("/auth/register")
		.set("Content-Type", "application/json")
		.send({ firstName: "Other", lastName: "User", userName: "progress_other", password: "passy" });
	otherToken = resp.body.accessToken;

	for (const [name, muscle_group] of [
		["Bench Press", "chest"],
		["Squat", "legs"],
		["Bicep Curl", "biceps"],
	]) {
		catalog[name] = (await ExerciseCatalogModel.create({ name, muscle_group })).catalog_id;
	}

	const workouts = [
		workoutPayload(OLD, [{ catalog_id: catalog["Bench Press"], order_number: 1, sets: [working(1, 5, 70)] }]),
		workoutPayload(EARLIER, [
			{
				catalog_id: catalog["Bench Press"],
				order_number: 1,
				sets: [{ order_number: 1, set_type: "warmup", notes: "", reps: 5, weight: 40 }, working(2, 5, 80), working(3, 5, 80)],
			},
			// the blank working row (no reps/weight) must not count as a set anywhere
			{ catalog_id: catalog["Squat"], order_number: 2, sets: [working(1, 5, 100), working(2, null, null)] },
		]),
		workoutPayload(RECENT, [
			// 85×5 is the heavier set, but 80×8 has the higher e1RM - the best set is picked by e1RM, not weight
			{ catalog_id: catalog["Bench Press"], order_number: 1, sets: [working(1, 5, 85), working(2, 8, 80)] },
			{ catalog_id: catalog["Bicep Curl"], order_number: 2, sets: [working(1, 12, 15), working(2, 10, 15)] },
		]),
	];

	for (const payload of workouts) {
		resp = await request(app).post("/workouts").set("Authorization", `Bearer ${token}`).send(payload);
		expect(resp.status).toEqual(200);
	}
}, 60000);

afterAll(async () => {
	await sequelize.close();
});

const get = (path, filter, authToken = token) => request(app).get(path).query({ filter }).set("Authorization", `Bearer ${authToken}`);

describe("GET /workouts/progress/biggest-changes", () => {
	test("compares first vs last e1RM for lifts logged at least twice in range", async () => {
		const resp = await get("/workouts/progress/biggest-changes", "month");

		expect(resp.status).toEqual(200);
		expect(resp.body.changes).toHaveLength(1); // squat and curl only appear once in the month
		const [bench] = resp.body.changes;
		expect(bench.name).toEqual("Bench Press");
		expect(bench.first_value).toBeCloseTo(e1rm(80, 5));
		expect(bench.last_value).toBeCloseTo(e1rm(80, 8));
		expect(bench.percent_change).toBeCloseTo(((e1rm(80, 8) - e1rm(80, 5)) / e1rm(80, 5)) * 100);
	});

	test("a wider filter moves the starting point back", async () => {
		const resp = await get("/workouts/progress/biggest-changes", "year");
		expect(resp.body.changes[0].first_value).toBeCloseTo(e1rm(70, 5));
		expect(resp.body.changes[0].first_date).toEqual(OLD);
	});

	test("requires auth", async () => {
		const resp = await request(app).get("/workouts/progress/biggest-changes");
		expect(resp.status).toEqual(401);
	});
});

describe("GET /workouts/progress/lifts", () => {
	test("lists lifts logged in range, most sessions first", async () => {
		const resp = await get("/workouts/progress/lifts", "month");

		expect(resp.status).toEqual(200);
		expect(resp.body.lifts.map((l) => l.name)).toEqual(["Bench Press", "Bicep Curl", "Squat"]);
		expect(resp.body.lifts[0]).toEqual({
			catalog_id: catalog["Bench Press"],
			name: "Bench Press",
			muscle_group: "chest",
			session_count: 2,
			last_date: RECENT,
		});
	});

	test("respects the date filter", async () => {
		const resp = await get("/workouts/progress/lifts", "week");
		expect(resp.body.lifts.map((l) => l.name)).toEqual(["Bench Press", "Bicep Curl"]);
	});

	test("never returns another user's lifts", async () => {
		const resp = await get("/workouts/progress/lifts", "all", otherToken);
		expect(resp.status).toEqual(200);
		expect(resp.body.lifts).toEqual([]);
	});
});

describe("GET /workouts/catalog/:id/history", () => {
	test("returns the best set per workout with weight, reps and e1RM", async () => {
		const resp = await get(`/workouts/catalog/${catalog["Bench Press"]}/history`, "month");

		expect(resp.status).toEqual(200);
		expect(resp.body.name).toEqual("Bench Press");
		expect(resp.body.muscle_group).toEqual("chest");
		expect(resp.body.data).toHaveLength(2);

		const [earlier, recent] = resp.body.data;
		expect(earlier).toMatchObject({ date: EARLIER, weight: 80, reps: 5, reps_in_reserve: 0 });
		expect(earlier.e1rm).toBeCloseTo(e1rm(80, 5));
		expect(recent).toMatchObject({ date: RECENT, weight: 80, reps: 8 });
		expect(recent.e1rm).toBeCloseTo(e1rm(80, 8));
	});

	test("includes older workouts under a wider filter, oldest first", async () => {
		const resp = await get(`/workouts/catalog/${catalog["Bench Press"]}/history`, "all");
		expect(resp.body.data.map((p) => p.date)).toEqual([OLD, EARLIER, RECENT]);
	});

	test("a lift with no data in range comes back empty", async () => {
		const resp = await get(`/workouts/catalog/${catalog["Squat"]}/history`, "week");
		expect(resp.status).toEqual(200);
		expect(resp.body.data).toEqual([]);
	});
});

describe("GET /workouts/progress/volume-by-muscle-group", () => {
	test("counts working sets and reps per muscle group, skipping warmups and blank sets", async () => {
		const resp = await get("/workouts/progress/volume-by-muscle-group", "month");

		expect(resp.status).toEqual(200);
		expect(resp.body.total_sets).toEqual(7);
		expect(resp.body.total_reps).toEqual(50);
		expect(resp.body.breakdown.map(({ muscle_group, sets, reps }) => ({ muscle_group, sets, reps }))).toEqual([
			{ muscle_group: "chest", sets: 4, reps: 23 },
			{ muscle_group: "biceps", sets: 2, reps: 22 },
			{ muscle_group: "legs", sets: 1, reps: 5 },
		]);
		expect(resp.body.breakdown[0].percent_of_sets).toBeCloseTo((4 / 7) * 100);
	});

	test("respects the date filter", async () => {
		const resp = await get("/workouts/progress/volume-by-muscle-group", "week");
		expect(resp.body.total_sets).toEqual(4);
		// chest and biceps tie on 2 sets each, so more reps (biceps 22 vs chest 13) breaks the tie
		expect(resp.body.breakdown.map((b) => b.muscle_group)).toEqual(["biceps", "chest"]);
	});

	test("returns zeros and no breakdown rows for a user with no workouts", async () => {
		const resp = await get("/workouts/progress/volume-by-muscle-group", "all", otherToken);
		expect(resp.body).toEqual({ total_sets: 0, total_reps: 0, breakdown: [] });
	});
});
