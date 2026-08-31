const request = require("supertest");
const app = require("../app");
//const { sequelize } = require("../models/modelInits");
const sequelize = require("../models/db");

//imports for models to verify database success after calls
const WorkoutsModel = require("../models/modelInits").workouts;
const ExercisesModel = require("../models/modelInits").exercises;
const SetsModel = require("../models/modelInits").sets;
const UsersModel = require("../models/modelInits").users;
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
