const request = require("supertest");
const app = require("../app");
const { sequelize } = require("../models/modelInits");

//imports for models to verify database success after calls
const WorkoutsModel = require("../models/modelInits").workouts;
const ExercisesModel = require("../models/modelInits").exercises;
const SetsModel = require("../models/modelInits").sets;
const UsersModel = require("../models/modelInits").users;

const { addUserPayload, addWorkoutPayload } = require("./TestPayloads");

var token;

//Create a mock user with JWT token for passing to workout endpoints
beforeAll(async () => {
	//Drop all data and then make a user to use for workout endpoint testing
	await sequelize.sync({ force: true });

	let resp = await request(app).post("/auth/register").set("Content-Type", "application/json").send(addUserPayload);
	token = resp.body.accessToken;
});

afterAll(async () => {
	await sequelize.close();
});

describe("Add/Edit Workout Endpoints", function () {
	test("Add Workout DB update", async function () {
		let resp = await request(app)
			.post("/workout/AddWorkout")
			.set("Content-Type", "application/json")
			.set("Authorization", `Bearer ${token}`)
			.send(addWorkoutPayload);

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
					],
				},
			],
			order: [
				[ExercisesModel, "order_number", "ASC"],
				[ExercisesModel, SetsModel, "order_number", "ASC"],
			],
		});
		console.log("What does my data look like: ");
		console.log(JSON.stringify(workout, null, 2));

		expect(workout).not.toBeNull();

		//workout
		expect(workout.name).toEqual(addWorkoutPayload.workout_name);
		expect(workout.workout_date).toEqual(addWorkoutPayload.workout_date);

		//exercises
		expect(workout.exercises[0].exercise_name).toEqual(addWorkoutPayload.exercises[0].exercise_name);
		expect(workout.exercises[0].order_number).toEqual(addWorkoutPayload.exercises[0].order_number);

		expect(workout.exercises[1].exercise_name).toEqual(addWorkoutPayload.exercises[1].exercise_name);
		expect(workout.exercises[1].order_number).toEqual(addWorkoutPayload.exercises[1].order_number);

		//sets
		expect(workout.exercises[0].sets[0].order_number).toEqual(addWorkoutPayload.exercises[0].sets[0].order_number);
		expect(workout.exercises[0].sets[1].set_type).toEqual(addWorkoutPayload.exercises[0].sets[1].set_type);

		expect(workout.exercises[1].sets[1].order_number).toEqual(addWorkoutPayload.exercises[1].sets[1].order_number);
		expect(workout.exercises[1].sets[0].set_type).toEqual(addWorkoutPayload.exercises[1].sets[0].set_type);
	});
});
