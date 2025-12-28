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
	if (user)
		console.log("found user")
	else
		console.log("No user found")
	try{
		var workout = await user.createWorkout({
			name: data.workout_name,
			workout_date: data.workout_date,
			notes: data.notes,
			finished_at: data.finished_at,
		});
	}catch(error){
		console.log("Failed to create workout")
		console.log(error)
	}

	if (workout)
		console.log("workout created!")

	//create exercises
	for (let exercise of data.exercises) {
		let newExercise;
		try{
			newExercise = await workout.createExercise({
				exercise_name: exercise.exercise_name,
				notes: exercise.notes,
				order_number: exercise.order_number
			});
		}catch(error){
			console.log(`Failed to create exercise ${exercise.exercise_name} for workout ${workout.workout_id}`)
			console.log(error)
		}

		if (newExercise)
			console.log(`Created new exercise with id ${newExercise.exercise_id} (${exercise.exercise_name})`)

		for (let set of exercise.sets) {
			let newSet;
			try{
				newSet = newExercise.createSet({
					set_number: set.set_number,//note set_number is NOT primary key, just numbering of sets (0 is warmup, 1+ is working)
					notes: set.notes,
					reps: set.reps,
					weight: set.weight,
					order_number: exercise.order_number
				});
			}catch(error){
				console.log(`Failed to create set ${set.set_id} for exercise ${newExercise.exercise_id}`)
				console.log(error)
			}
			if (newExercise)
				console.log(`Created new set with id ${newSet.set_id} (for ${exercise.exercise_id})`)
		}
	}

	return workout;
}

async function EditWorkout(data, workout_id) {
	//console.log("workout id: ", workout_id)
	let workout_obj = await WorkoutsModel.findByPk(workout_id)
	//console.log("Did I find my workout?", workout_obj)

	/* let workout = await workout_obj.update({
		name: data.workout_name,
		workout_date: data.workout_date,
		notes: data.notes,
		finished_at: data.finished_at,
	}); */

	//grab list of exercises/sets for a workout stored in database.
	//also loop over each exercise/set for a workout provided in data

	//if we have exercise/set_id not found in database (found in data), add it to database

	//if we have exercise/set_id in database that isn't in workout, remove it from database

	const exercisesList = await ExercisesModel.findAll({where: {workout_id:workout_id}, include: SetsModel});
	//cast exercises and sets into a map
	let javascriptArray = exercisesList.map(exercise => exercise.toJSON());

	//console.log("JSON converted: ", javascriptArray)

	//If object in database but not in passed data: remove
	for (let dbExercise of javascriptArray){
		//if exercise id in database not found in data: remove
		let shouldExist = data.exercise.some(exercise => exercise.exercise_id === dbExercise.exercise_id)
		if (!shouldExist){
			console.log(`Removing exercise: ${dbExercise.exercise_id} from database`)
			await ExercisesModel.destroy({where: {exercise_id:dbExercise.exercise_id}})
		}
		
		//now check each set id of each exercise to see if it should exist
		for (let dbSet of dbExercise.sets){
			shouldExist = data.exercise.some(set => set.set_id === dbSet.set_id)
			if (!shouldExist){
				console.log(`Removing set: ${dbSet.set_id} from database`)
				await SetsModel.destroy({where: {set_id:dbSet.set_id}})
			}
		}
	}
	

	return null
	console.log("Workout data before update:")
	console.log("------------------------------")
	console.log(JSON.stringify(exercisesList, null, 2));
	console.log("------------------------------")

	for (let exercise of data.exercises) {
		let exercise_obj = await ExercisesModel.findByPk(exercise.exercise_id)
		if (exercise_obj == null){
			//we have a new exercise
			let newExercise = await workout.createExercise({
				exercise_name: exercise.exercise_name,
				notes: exercise.notes,
			});

			//create corresponding new sets for newly added exercise
			for (let set of exercise.sets) {
				await newExercise.createSet({
					set_number: set.set_number,//note set_number is NOT primary key, just numbering of sets (0 is warmup, 1+ is working)
					notes: set.notes,
					reps: set.reps,
					weight: set.weight,
				});
			}
		}
		
		else{
			//existing exercise to update
			let updatedExercise = exercise_obj.update({
				exercise_name: exercise.exercise_name,
				notes: exercise.notes,
			});

			//loop over data exercise's sets to update/add
			for (let set of exercise.sets) {
				let set_obj = await ExercisesModel.findByPk(set.set_id)
				if (set_obj == null){
					//we have a new set for exercise
					await exercise_obj.createSet({
						set_number: set.set_number,//note set_number is NOT primary key, just numbering of sets (0 is warmup, 1+ is working)
						notes: set.notes,
						reps: set.reps,
						weight: set.weight,
					});
				}
				else{
					await set_obj.update({
						set_number: set.set_number,
						notes: set.notes,
						reps: set.reps,
						weight: set.weight
					})
				}
			}
		}
	}

	const exercisesListAfter = await ExercisesModel.findAll({where: {workout_id:workout_id}, include: SetsModel});
	console.log("Workout data AFTER update:")
	console.log("------------------------------")
	console.log(JSON.stringify(exercisesListAfter, null, 2));
	console.log("------------------------------")

}

async function EditWorkout2(data, user_id, workout_id) {

	let workout_obj = await WorkoutsModel.findByPk(workout_id)

	let workout = await workout_obj.update({
		name: data.workout_name,
		workout_date: data.workout_date,
		notes: data.notes,
		finished_at: data.finished_at,
	});
	

	//update exercises per workout and sets per exercise
	for (let exercise of data.exercises) {
		let exercise_obj = await ExercisesModel.findByPk(exercise.exercise_id)
		if (exercise_obj == null){
			//new exercise
			let newExercise = await workout.createExercise({
				exercise_name: exercise.exercise_name,
				notes: exercise.notes,
			});

			//add corresponding sets for that exercise
			for (let set of exercise.sets) {
				newExercise.createSet({
					set_number: set.set_number,//note set_number is NOT primary key, just numbering of sets (0 is warmup, 1+ is working)
					notes: set.notes,
					reps: set.reps,
					weight: set.weight,
				});
			}


		}
		else{
			let updatedExercise = exercise_obj.update({
				exercise_name: exercise.exercise_name,
				notes: exercise.notes,
			});
		}

		for (let set of exercise.sets) {
			let set_obj = await SetsModel.findByPk(set.set_id)
			if (set_obj === null){
				//new set was added
				//add corresponding sets for that exercise
				for (let set of exercise.sets) {
					newExercise.createSet({
						set_number: set.set_number,//note set_number is NOT primary key, just numbering of sets (0 is warmup, 1+ is working)
						notes: set.notes,
						reps: set.reps,
						weight: set.weight,
					});
				}

			}
			set_obj.update({
				set_number: set.set_number,
				notes: set.notes,
				reps: set.reps,
				weight: set.weight,
			});
		}
	}

	return workout;

}

module.exports = { GetWorkouts, CreateWorkout, EditWorkout};
