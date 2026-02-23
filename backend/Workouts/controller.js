const service = require("./service");
const jwt = require("jsonwebtoken");

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
	return res.status(200).json({ workouts });
	//For now we'll keep as GET and just allow 'week', 'month', 'year', 'all' filters (all is default)
}

async function getWorkout(req, res) {
	let workoutId = req.params.id;
	//shouldn't need user_id here since workout id corresponds to certain user's workout

	try {
		let workout = await service.GetWorkouts(workoutId);
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
	await Workout;
}

module.exports = { getWorkoutsList, getWorkout, createWorkout, editWorkout, deleteWorkout };
