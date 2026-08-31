const service = require("./service");
const jwt = require("jsonwebtoken");

//helper function to serialze some data for frontend use
function serializeWorkoutListItem(workout) {
	const w = workout.toJSON();
	const allSets = (w.exercises ?? []).flatMap((e) => e.sets ?? []);

	const totalVolumeKg = allSets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);

	let durationMinutes;
	if (w.finished_at && w.workout_date) {
		const diffMs = new Date(w.finished_at) - new Date(w.workout_date);
		if (diffMs > 0) durationMinutes = Math.round(diffMs / 60000);
	}

	return {
		id: w.workout_id,
		name: w.name,
		date: w.workout_date,
		notes: w.notes,
		duration_minutes: durationMinutes,
		total_volume_kg: totalVolumeKg || undefined,
	};
}

async function getWorkoutsList(req, res) {
	let { filter } = req.query; //So we might apply a time frame or a specific type of lift etc.
	//Might turn this into a POST request so we can apply more and more filters
	console.log("my filter is:", filter);

	//get which user
	const accessToken = req.headers.authorization.split(" ")[1];
	const user = jwt.verify(accessToken, process.env.JWT_SECRET, {
		audience: "my-gym-app",
		issuer: "gym-auth-server",
	});
	let user_id = user.user_id;

	let workouts = await service.GetWorkouts(user_id, filter);
	if (workouts.length == 0) return res.status(200).json({ workouts, message: "No Workouts Found" });
	return res.status(200).json({ workouts: workouts.map(serializeWorkoutListItem) });
	//For now we'll keep as GET and just allow 'week', 'month', 'year', 'all' filters (all is default)
}

async function getWorkout(req, res) {
	let workoutId = req.params.id;
	//shouldn't need user_id here since workout id corresponds to certain user's workout
	console.log("THIS SHIT IS FUCKING GAY");
	try {
		let workout = await service.GetWorkout(workoutId);
		return res.status(200).json({ workout });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function createWorkout(req, res) {
	//req.body should contain everything for a workout
	/*
	{
		workout_name: "Push",
		workout_date: "some date"
		notes: ""
		finished_at: ""

		exercises:
		[
			{
				exercise_name: "Bench Press",
				notes: "blah"
				sets: [{
					set_number: 0, "0 is warmup(s), 1+ otherwise"
					notes: "",
					reps: 2,
					weight: 150 (store everything as lbs and add a option to switch to kg on frontend later)
				},
				{
					set_number: 1,
					notes: "first set",
					reps: 4,
					weight: 180
				}
				]
			}
		
		
		]
		
	}
	*/
	const accessToken = req.headers.authorization.split(" ")[1];
	const user = jwt.verify(accessToken, process.env.JWT_SECRET, {
		audience: "my-gym-app",
		issuer: "gym-auth-server",
	});
	user_id = user.user_id;
	try {
		let workout = await service.CreateWorkout(req.body, user_id); //workout object (might) also contain exercises/sets
		return res.status(200).json({ workout });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function editWorkout(req, res) {
	//workout ID for a user
	//possibly a set/rep?

	//Theres a scenario where we delete data from a workout or just edit it
	//so send entire workout object, and if it doesn't match up, set this data as the true value.
	const accessToken = req.headers.authorization.split(" ")[1];
	const user = jwt.verify(accessToken, process.env.JWT_SECRET, {
		audience: "my-gym-app",
		issuer: "gym-auth-server",
	});
	user_id = user.user_id;
	let workoutId = req.params.id;
	try {
		let modified_workout = await service.EditWorkout(req.body, workoutId); //workout object (might) also contain exercises/sets
		return res.status(200).json({ modified_workout });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function deleteWorkout(req, res) {
	let workout_id = req.params.id;
	try {
		await service.DeleteWorkout(workout_id); //successfully deleted
		return res.status(200).json({ message: "Workout deleted successfully" });
	} catch (error) {
		//failed to delete
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function searchCatalog(req, res) {
	let { search, muscle_group } = req.query;

	try {
		let exercises = await service.SearchCatalogExercises({ search, muscle_group });
		return res.status(200).json({ exercises });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

//shared by every /progress endpoint: decode the JWT for user_id, and turn the ?filter= query param
//into a concrete {startDate, now} range ("all" goes back 100 years - effectively "everything")
function getUserIdAndRangeFromRequest(req) {
	const { filter = "month" } = req.query;

	const accessToken = req.headers.authorization.split(" ")[1];
	const user = jwt.verify(accessToken, process.env.JWT_SECRET, {
		audience: "my-gym-app",
		issuer: "gym-auth-server",
	});
	const user_id = user.user_id;

	const now = new Date();
	const startDate = new Date();
	if (filter === "week") startDate.setDate(startDate.getDate() - 7);
	else if (filter === "month") startDate.setDate(startDate.getDate() - 30);
	else if (filter === "year") startDate.setDate(startDate.getDate() - 365);
	else startDate.setFullYear(startDate.getFullYear() - 100); //"all"

	return { user_id, startDate, now };
}

async function getBiggestChanges(req, res) {
	const { user_id, startDate, now } = getUserIdAndRangeFromRequest(req);

	try {
		const changes = await service.getBiggest5Changes(user_id, startDate, now);
		return res.status(200).json({ changes });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function getExerciseHistory(req, res) {
	const catalog_id = req.params.id;
	const { epley } = req.query;
	const { user_id, startDate, now } = getUserIdAndRangeFromRequest(req);

	try {
		const history = await service.exerciseOverTime(user_id, startDate, now, catalog_id, epley === "true");
		return res.status(200).json(history);
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function getVolumeByMuscleGroup(req, res) {
	const { user_id, startDate, now } = getUserIdAndRangeFromRequest(req);

	try {
		const volume = await service.getVolumeByMuscleGroup(user_id, startDate, now);
		return res.status(200).json(volume);
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function getFatigueCurves(req, res) {
	const { epley } = req.query;
	const { user_id, startDate, now } = getUserIdAndRangeFromRequest(req);

	try {
		const curves = await service.getFatigueCurves(user_id, startDate, now, epley === "true");
		return res.status(200).json({ curves });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function getWeeklyVolumeLandmarks(req, res) {
	const { user_id, startDate, now } = getUserIdAndRangeFromRequest(req);

	try {
		const weeks = await service.getWeeklyVolumeLandmarks(user_id, startDate, now);
		return res.status(200).json({ weeks });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function getPersonalRecordTimeline(req, res) {
	const { user_id, startDate, now } = getUserIdAndRangeFromRequest(req);

	try {
		const records = await service.getPersonalRecordTimeline(user_id, startDate, now);
		return res.status(200).json({ records });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function getTrainingFrequency(req, res) {
	const { user_id, startDate, now } = getUserIdAndRangeFromRequest(req);

	try {
		const weeks = await service.getTrainingFrequency(user_id, startDate, now);
		return res.status(200).json({ weeks });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function getSessionTrends(req, res) {
	const { user_id, startDate, now } = getUserIdAndRangeFromRequest(req);

	try {
		const weeks = await service.getSessionTrends(user_id, startDate, now);
		return res.status(200).json({ weeks });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function getRepRangeDistribution(req, res) {
	const { user_id, startDate, now } = getUserIdAndRangeFromRequest(req);

	try {
		const distribution = await service.getRepRangeDistribution(user_id, startDate, now);
		return res.status(200).json({ distribution });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function createCatalogExercise(req, res) {
	/*
	{
		name: "Bench Press",
		muscle_group: "chest"
	}
	*/
	try {
		let exercise = await service.CreateCatalogExercise(req.body);
		return res.status(200).json({ exercise });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

module.exports = {
	getWorkoutsList,
	getWorkout,
	createWorkout,
	editWorkout,
	deleteWorkout,
	searchCatalog,
	createCatalogExercise,
	getBiggestChanges,
	getExerciseHistory,
	getVolumeByMuscleGroup,
	getFatigueCurves,
	getWeeklyVolumeLandmarks,
	getPersonalRecordTimeline,
	getTrainingFrequency,
	getSessionTrends,
	getRepRangeDistribution,
};
