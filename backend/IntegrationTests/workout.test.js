const request = require("supertest");
const app = require("../app");
//const { sequelize } = require("../models/modelInits");
const sequelize = require("../models/db");

//imports for models to verify database success after calls
const WorkoutsModel = require("../models/modelInits").workouts;
const ExercisesModel = require("../models/modelInits").exercises;
const SetsModel = require("../models/modelInits").sets;
const ExerciseCatalogModel = require("../models/modelInits").exercise_catalog;

const { addUserPayload, editWorkoutPayloads, addWorkoutPayload } = require("./WorkoutPayloads");

var token;

// exercise_catalog include, reused by every query below so assertions can check exercise_catalog.name -
// exercises no longer carry a free-text exercise_name column, just a catalog_id foreign key.
const catalogInclude = { model: ExerciseCatalogModel };

//Create a mock user with JWT token for passing to workout endpoints
//sync({force:true}) rebuilds every table against the real remote DB - Jest's default 5s hook timeout is
//too tight for that round-trip and flakes under normal network latency, so it's extended here (see the
//identical fix/comment in nutrition.test.js).
beforeAll(async () => {
	//Drop all data and then make a user to use for workout endpoint testing
	await sequelize.sync({ force: true });

	let resp = await request(app).post("/auth/register").set("Content-Type", "application/json").send(addUserPayload);
	token = resp.body.accessToken;

	// The exercises table stores a catalog_id foreign key (not a free-text exercise name), so the fixture
	// payloads need real exercise_catalog rows to reference. Seed one per distinct exercise_name used across
	// WorkoutPayloads.js, then patch that catalog_id onto every payload exercise, matched by name.
	const catalogByName = {};
	const catalogSeeds = { "Bench Press": "chest", "Incline Dumbbell Press": "chest", "Tricep Pushdown": "triceps" };
	for (const [name, muscle_group] of Object.entries(catalogSeeds)) {
		const row = await ExerciseCatalogModel.create({ name, muscle_group });
		catalogByName[name] = row.catalog_id;
	}

	for (const exercise of addWorkoutPayload.exercises) {
		exercise.catalog_id = catalogByName[exercise.exercise_name];
	}
	for (const payload of editWorkoutPayloads) {
		for (const exercise of payload.exercises) {
			exercise.catalog_id = catalogByName[exercise.exercise_name];
		}
	}
}, 30000);

afterAll(async () => {
	await sequelize.close();
});

describe("Add/Edit/Delete Workout Endpoints", function () {
	test("Add Workout DB update", async function () {
		let resp = await request(app).post("/Workouts").set("Content-Type", "application/json").set("Authorization", `Bearer ${token}`).send(addWorkoutPayload);

		expect(resp.status).toEqual(200);

		//query workout/exercises/sets to make sure we have expected data in database
		const workout = await WorkoutsModel.findByPk(resp.body.workout.workout_id, {
			include: [
				{
					model: ExercisesModel, //join w/ exercise model
					include: [
						{
							model: SetsModel, //join with set model
						},
						catalogInclude,
					],
				},
			],
			order: [
				[ExercisesModel, "order_number", "ASC"],
				[ExercisesModel, SetsModel, "order_number", "ASC"],
			],
		});

		expect(workout).not.toBeNull();

		//workout
		expect(workout.name).toEqual(addWorkoutPayload.workout_name);
		expect(workout.workout_date).toEqual(addWorkoutPayload.workout_date);

		//exercises
		expect(workout.exercises[0].exercise_catalog.name).toEqual(addWorkoutPayload.exercises[0].exercise_name);
		expect(workout.exercises[0].order_number).toEqual(addWorkoutPayload.exercises[0].order_number);

		expect(workout.exercises[1].exercise_catalog.name).toEqual(addWorkoutPayload.exercises[1].exercise_name);
		expect(workout.exercises[1].order_number).toEqual(addWorkoutPayload.exercises[1].order_number);

		//sets
		expect(workout.exercises[0].sets[0].order_number).toEqual(addWorkoutPayload.exercises[0].sets[0].order_number);
		expect(workout.exercises[0].sets[1].set_type).toEqual(addWorkoutPayload.exercises[0].sets[1].set_type);

		expect(workout.exercises[1].sets[1].order_number).toEqual(addWorkoutPayload.exercises[1].sets[1].order_number);
		expect(workout.exercises[1].sets[0].set_type).toEqual(addWorkoutPayload.exercises[1].sets[0].set_type);
	});

	test("Edit Workout DB Updates", async function () {
		for (const ewPayload of editWorkoutPayloads) {
			let resp = await request(app).put("/Workouts/1").set("Content-Type", "application/json").set("Authorization", `Bearer ${token}`).send(ewPayload);
			expect(resp.status).toEqual(200);

			//for each payload, query workout 1
			// expect that the workout name matches, workout notes, workout date, correct number of exercises
			// expect that each exercise name matches/order_number/notes
			// expect correct number of sets, and that each set has order_number/set_type/reps/notes/weight

			const workout = await WorkoutsModel.findByPk(resp.body.modified_workout.workout_id, {
				include: [
					{
						model: ExercisesModel, //join w/ exercise model
						include: [
							{
								model: SetsModel, //join with set model
							},
							catalogInclude,
						],
					},
				],
				order: [
					[ExercisesModel, "order_number", "ASC"],
					[ExercisesModel, SetsModel, "order_number", "ASC"],
				],
			});

			expect(workout.name).toEqual(ewPayload.workout_name);
			expect(workout.workout_date).toEqual(ewPayload.workout_date);
			expect(workout.exercises.length).toEqual(ewPayload.exercises.length);

			for (let i = 0; i < workout.exercises.length; i++) {
				expect(workout.exercises[i].exercise_catalog.name).toEqual(ewPayload.exercises[i].exercise_name);
				expect(workout.exercises[i].order_number).toEqual(ewPayload.exercises[i].order_number);
				expect(workout.exercises[i].notes).toEqual(ewPayload.exercises[i].notes);

				for (let j = 0; j < workout.exercises[i].sets.length; j++) {
					expect(workout.exercises[i].sets[j].order_number).toEqual(ewPayload.exercises[i].sets[j].order_number);
					expect(workout.exercises[i].sets[j].set_type).toEqual(ewPayload.exercises[i].sets[j].set_type);
					expect(workout.exercises[i].sets[j].reps).toEqual(ewPayload.exercises[i].sets[j].reps);
					expect(workout.exercises[i].sets[j].weight).toEqual(ewPayload.exercises[i].sets[j].weight);
					expect(workout.exercises[i].sets[j].notes).toEqual(ewPayload.exercises[i].sets[j].notes);
				}
			}
		}
	});

	test("Delete Workout DB", async function () {
		//No payload needed for this, just remove the workout id 1
		let resp = await request(app).delete("/Workouts/1").set("Content-Type", "application/json").set("Authorization", `Bearer ${token}`);
		expect(resp.status).toEqual(200);

		//should be null
		const workout = await WorkoutsModel.findByPk(1, {
			include: [
				{
					model: ExercisesModel, //join w/ exercise model
					include: [
						{
							model: SetsModel, //join with set model
						},
					],
				},
			],
			order: [
				[ExercisesModel, "order_number", "ASC"],
				[ExercisesModel, SetsModel, "order_number", "ASC"],
			],
		});

		expect(workout).toBeNull(); //workout should be null
	});
});

describe("GET /workouts/:id", function () {
	test("returns the workout in the same shape POST accepts (workout_name, exercise_name)", async function () {
		let resp = await request(app).post("/Workouts").set("Authorization", `Bearer ${token}`).send(addWorkoutPayload);
		expect(resp.status).toEqual(200);
		const workoutId = resp.body.workout.workout_id;

		resp = await request(app).get(`/workouts/${workoutId}`).set("Authorization", `Bearer ${token}`);
		expect(resp.status).toEqual(200);

		const { workout } = resp.body;
		expect(workout.workout_id).toEqual(workoutId);
		expect(workout.workout_name).toEqual(addWorkoutPayload.workout_name);
		expect(workout.workout_date).toEqual(addWorkoutPayload.workout_date);
		expect(workout.notes).toEqual(""); // stays a string, never null
		expect(typeof workout.created_at).toEqual("string");
		expect(workout).not.toHaveProperty("name");

		expect(workout.exercises.map((e) => e.exercise_name)).toEqual(addWorkoutPayload.exercises.map((e) => e.exercise_name));
		const [bench] = workout.exercises;
		expect(bench).not.toHaveProperty("exercise_catalog");
		expect(bench.catalog_id).toEqual(addWorkoutPayload.exercises[0].catalog_id);
		expect(bench.sets.map(({ order_number, set_type, notes, reps, weight }) => ({ order_number, set_type, notes, reps, weight }))).toEqual(
			addWorkoutPayload.exercises[0].sets,
		);
	});
});

describe("workout duration (finished_at - started_at)", function () {
	const auth = () => ({ Authorization: `Bearer ${token}` });
	const create = (fields) => request(app).post("/workouts").set(auth()).send({ ...addWorkoutPayload, ...fields });
	const durationOf = async (workout_id) => {
		const resp = await request(app).get("/workouts").set(auth());
		return resp.body.workouts.find((w) => w.id === workout_id).duration_minutes;
	};

	test("a real start and finish gives the real length, whatever the time zone", async function () {
		//5pm -> 6pm in New York. The old code measured from UTC midnight and said 1380 min
		const resp = await create({ started_at: "2025-12-27T22:00:00.000Z", finished_at: "2025-12-27T23:00:00.000Z" });
		expect(resp.status).toEqual(200);
		expect(await durationOf(resp.body.workout.workout_id)).toEqual(60);
	});

	test("GET /workouts/:id returns started_at", async function () {
		const resp = await create({ started_at: "2025-12-27T22:00:00.000Z" });
		const got = await request(app).get(`/workouts/${resp.body.workout.workout_id}`).set(auth());
		expect(new Date(got.body.workout.started_at).toISOString()).toEqual("2025-12-27T22:00:00.000Z");
	});

	//what the editor sends back after loading a workout: the GET shape, with some fields changed
	const editWith = async (workout_id, changes) => {
		const loaded = (await request(app).get(`/workouts/${workout_id}`).set(auth())).body.workout;
		return request(app)
			.put(`/workouts/${workout_id}`)
			.set(auth())
			.send({ ...loaded, ...changes });
	};

	test("an edit can correct started_at, and the duration follows", async function () {
		const resp = await create({ started_at: "2025-12-27T14:30:00.000Z", finished_at: "2025-12-27T15:30:00.000Z" });
		const workout_id = resp.body.workout.workout_id;

		expect((await editWith(workout_id, { started_at: "2025-12-27T15:00:00.000Z" })).status).toEqual(200);

		const row = await WorkoutsModel.findByPk(workout_id);
		expect(row.started_at.toISOString()).toEqual("2025-12-27T15:00:00.000Z");
		expect(await durationOf(workout_id)).toEqual(30);
	});

	test("an edit that doesn't touch started_at keeps it", async function () {
		const resp = await create({ started_at: "2025-12-27T14:30:00.000Z", finished_at: "2025-12-27T15:30:00.000Z" });
		const workout_id = resp.body.workout.workout_id;

		expect((await editWith(workout_id, { notes: "edited" })).status).toEqual(200);

		const row = await WorkoutsModel.findByPk(workout_id);
		expect(row.notes).toEqual("edited");
		expect(row.started_at.toISOString()).toEqual("2025-12-27T14:30:00.000Z");
	});

	test("an edit with a bad started_at -> 400, nothing changed", async function () {
		const resp = await create({ started_at: "2025-12-27T14:30:00.000Z" });
		const workout_id = resp.body.workout.workout_id;

		expect((await editWith(workout_id, { started_at: "2025-12-27", notes: "should not save" })).status).toEqual(400);

		const row = await WorkoutsModel.findByPk(workout_id);
		expect(row.notes).not.toEqual("should not save");
		expect(row.started_at.toISOString()).toEqual("2025-12-27T14:30:00.000Z");
	});

	test("no started_at (older workouts) -> no duration", async function () {
		const resp = await create({});
		expect(resp.status).toEqual(200);
		expect(await durationOf(resp.body.workout.workout_id)).toBeUndefined();
	});

	test("left open over 6 hours, or finished before it started -> no duration", async function () {
		const overnight = await create({ started_at: "2025-12-26T18:00:00.000Z", finished_at: "2025-12-27T08:00:00.000Z" });
		expect(await durationOf(overnight.body.workout.workout_id)).toBeUndefined();

		const backwards = await create({ started_at: "2025-12-27T16:00:00.000Z", finished_at: "2025-12-27T15:30:00.000Z" });
		expect(await durationOf(backwards.body.workout.workout_id)).toBeUndefined();
	});

	test("a started_at that isn't an ISO date and time -> 400, nothing saved", async function () {
		const before = await WorkoutsModel.count();
		for (const started_at of ["not a date", "2025-12-27", 12345]) {
			expect((await create({ started_at })).status).toEqual(400);
		}
		expect(await WorkoutsModel.count()).toEqual(before);
	});
});
