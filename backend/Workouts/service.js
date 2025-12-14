const WorkoutsModel = require("../models/modelInits").workouts;
const ExercisesModel = require("../models/modelInits").exercises;
const SetsModel = require("../models/modelInits").sets;
const UsersModel = require("../models/modelInits").users;

async function GetWorkouts(user_id, filter) {
	let workouts;
	let now = new Date();

	if (filter == "all") workouts = await WorkoutsModel.findAll({ where: { user_id: user_id } });
	else if (filter == "week") {
		let oneWeekAgo = new Date();
		oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
		workouts = await WorkoutsModel.findAll({
			where: { workout_date: { [Op.between]: [oneWeekAgo, now] } },
		});
	} else if (filter == "month") {
		let oneMonthAgo = new Date();
		oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
		workouts = await WorkoutsModel.findAll({
			where: { workout_date: { [Op.between]: [oneMonthAgo, now] } },
		});
	} else if (filter == "year") {
		let oneYearAgo = new Date();
		oneYearAgo.setDate(oneYearAgo.getDate() - 365);
		workouts = await WorkoutsModel.findAll({
			where: { workout_date: { [Op.between]: [oneYearAgo, now] } },
		});
	}
	return workouts;
}

async function CreateWorkout(data, user_id) {
	//createWorkout
	const user = await UsersModel.findOne({ where: { user_id: user_id } });
	let workout = await user.createWorkout({
		name: data.workout_name,
		workout_date: data.workout_date,
		notes: data.notes,
		finished_at: data.finished_at,
	});

	//create exercises
	for (let exercise of data.exercises) {
		let newExercise = await workout.createExercise({
			exercise_name: exercise.exercise_name,
			notes: exercise.notes,
		});

		for (let set of exercise.sets) {
			newExercise.createSet({
				set_number: set.set_number,
				notes: set.notes,
				reps: set.reps,
				weight: set.weight,
			});
		}
	}

	return workout;
}

async function EditWorkout(data, user_id) {}

module.exports = { GetWorkouts, CreateWorkout };
