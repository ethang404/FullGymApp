const WorkoutsModel = require("../models/modelInits").workouts;
const ExercisesModel = require("../models/modelInits").exercises;
const SetsModel = require("../models/modelInits").sets;
const UsersModel = require("../models/modelInits").users;

//error imports
const { GeneralError, NotFoundError, DataError, UnauthorizedError, ForbiddenError } = require("../error");

async function GetWorkouts(user_id, filter = "all") {
	let workouts;
	let now = new Date();
	let startDate = new Date();

	if (filter == "all")
		return await WorkoutsModel.findAll({
			where: { user_id: user_id },
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
	else if (filter == "week") startDate.setDate(startDate.getDate() - 7);
	else if (filter == "month") startDate.setDate(startDate.getDate() - 30);
	else if (filter == "year") startDate.setDate(startDate.getDate() - 365);

	workouts = await WorkoutsModel.findAll({
		where: { workout_date: { [Op.between]: [startDate, now] }, user_id: user_id },
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
	return workouts;
}

async function GetWorkout(workout_id) {
	const workout = await WorkoutsModel.findByPk(workout_id, {
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

	if (!workout) throw new NotFoundError("No workout found with that workout ID");
	return workout;
}

async function CreateWorkout(data, user_id) {
	//createWorkout
	const user = await UsersModel.findOne({ where: { user_id: user_id } });
	if (!user) throw new GeneralError("No user found or authentication expired"); //this shouldn't even hit

	if (!data.workout_name || !data.workout_date) throw new DataError("Workout Name and Workout Date required");

	var workout = await user.createWorkout({
		name: data.workout_name,
		workout_date: data.workout_date,
		notes: data.notes,
		finished_at: data.finished_at,
	});

	//create exercises
	for (let exercise of data.exercises) {
		let newExercise;
		newExercise = await workout.createExercise({
			exercise_name: exercise.exercise_name,
			notes: exercise.notes,
			order_number: exercise.order_number,
		});

		if (newExercise) console.log(`Created new exercise with id ${newExercise.exercise_id} (${exercise.exercise_name})`);

		for (let set of exercise.sets) {
			let newSet;
			newSet = await newExercise.createSet({
				notes: set.notes,
				reps: set.reps,
				weight: set.weight,
				set_type: set.set_type, //"warmup" vs "working" etc.
				order_number: set.order_number, //order of sets (1-x)
			});

			if (newExercise) console.log(`Created new set with id ${newSet.set_id} (for ${exercise.exercise_id})`);
		}
	}

	return workout;
}

async function EditWorkout(data, workout_id) {
	//console.log("workout id: ", workout_id)
	let workout_obj = await WorkoutsModel.findByPk(workout_id);
	//console.log("Did I find my workout?", workout_obj)

	let workout = await workout_obj.update({
		name: data.workout_name,
		workout_date: data.workout_date,
		notes: data.notes,
		finished_at: data.finished_at,
	});

	//grab list of exercises/sets for a workout stored in database.
	//also loop over each exercise/set for a workout provided in data

	//if we have exercise/set_id not found in database (found in data), add it to database

	//if we have exercise/set_id in database that isn't in workout, remove it from database

	if (!workout_obj) throw new NotFoundError("No workout found with that id");

	const exercisesList = await ExercisesModel.findAll({
		where: { workout_id: workout_id },
		include: SetsModel,
	});
	//cast exercises and sets into a map
	let javascriptArray = exercisesList.map((exercise) => exercise.toJSON());

	//console.log("JSON converted: ", javascriptArray)

	//If object in database but not in passed data: remove
	for (let dbExercise of javascriptArray) {
		//if exercise id in database not found in data: remove
		let shouldExist = data.exercises.some((exercise) => exercise.exercise_id === dbExercise.exercise_id);
		if (!shouldExist) {
			console.log(`Removing exercise: ${dbExercise.exercise_id} from database`);
			await ExercisesModel.destroy({ where: { exercise_id: dbExercise.exercise_id } });
		} else {
			//now check each set id of each exercise we DIDN'T REMOVE to see if it should exist
			let exerciseSets = data.exercises.find((exercise) => exercise.exercise_id === dbExercise.exercise_id);
			for (let dbSet of dbExercise.sets) {
				shouldExist = exerciseSets.sets.some((set) => set.set_id === dbSet.set_id);
				if (!shouldExist) {
					console.log(`Removing set: ${dbSet.set_id} from database`);
					await SetsModel.destroy({
						where: { set_id: dbSet.set_id, exercise_id: dbExercise.exercise_id },
					});
				}
			}
		}
	}
	console.log("EVERYTHING WORKS SO FAR");
	for (let exercise of data.exercises) {
		let exercise_obj = await ExercisesModel.findByPk(exercise.exercise_id);
		if (exercise_obj == null) {
			//we have a new exercise
			let newExercise = await workout_obj.createExercise({
				exercise_name: exercise.exercise_name,
				notes: exercise.notes,
				order_number: exercise.order_number,
			});

			//create corresponding new sets for newly added exercise
			for (let set of exercise.sets) {
				await newExercise.createSet({
					set_type: set.set_type,
					order_number: set.order_number,
					notes: set.notes,
					reps: set.reps,
					weight: set.weight,
				});
			}
		} else {
			//existing exercise to update
			let updatedExercise = await exercise_obj.update({
				exercise_name: exercise.exercise_name,
				order_number: exercise.order_number,
				notes: exercise.notes,
			});

			//loop over data exercise's sets to update/add
			for (let set of exercise.sets) {
				let set_obj = await SetsModel.findByPk(set.set_id);
				if (set_obj == null) {
					//we have a new set for exercise
					await exercise_obj.createSet({
						set_type: set.set_type,
						order_number: set.order_number,
						notes: set.notes,
						reps: set.reps,
						weight: set.weight,
					});
				} else {
					await set_obj.update({
						set_type: set.set_type,
						order_number: set.order_number,
						notes: set.notes,
						reps: set.reps,
						weight: set.weight,
					});
				}
			}
		}
	}

	/*
	const exercisesListAfter = await ExercisesModel.findAll({
		where: { workout_id: workout_id },
		include: SetsModel,
	});
	console.log("Workout data AFTER update:");
	console.log("------------------------------");
	console.log(JSON.stringify(exercisesListAfter, null, 2));
	console.log("------------------------------");*/

	//lets return entire workout object, that makes more sense than exercise list
	const workout_modified = await WorkoutsModel.findByPk(workout_id, {
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
	return workout_modified;
}

module.exports = { GetWorkouts, GetWorkout, CreateWorkout, EditWorkout };
