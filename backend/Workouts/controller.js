const service = require("./service");

async function getWorkoutsList(req, res) {
	let { filter } = req.query; //range of workouts

	let user_id = req.user_id;

	let workouts = await service.GetWorkouts(user_id, filter);
	if (workouts.length == 0) return res.status(200).json({ workouts, message: "No Workouts Found" });
	return res.status(200).json({ workouts }); //already serialized by the service
	//For now we'll keep as GET and just allow 'week', 'month', 'year', 'all' filters (all is default)
}

async function getWorkout(req, res) {
	let workoutId = req.params.id;
	let workout = await service.GetWorkout(workoutId, req.user_id);
	return res.status(200).json({ workout });
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
	const user_id = req.user_id;
	let workout = await service.CreateWorkout(req.body, user_id); //workout object (might) also contain exercises/sets
	return res.status(200).json({ workout });
}

async function editWorkout(req, res) {
	//workout ID for a user
	//possibly a set/rep?

	//Theres a scenario where we delete data from a workout or just edit it
	//so send entire workout object, and if it doesn't match up, set this data as the true value.
	let workoutId = req.params.id;
	let modified_workout = await service.EditWorkout(req.body, workoutId, req.user_id); //workout object (might) also contain exercises/sets
	return res.status(200).json({ modified_workout });
}

async function deleteWorkout(req, res) {
	let workout_id = req.params.id;
	await service.DeleteWorkout(workout_id, req.user_id); //successfully deleted
	return res.status(200).json({ message: "Workout deleted successfully" });
}

async function searchCatalog(req, res) {
	let { search, muscle_group } = req.query;

	let exercises = await service.SearchCatalogExercises({ search, muscle_group });
	return res.status(200).json({ exercises });
}

//shared by every /progress endpoint: turns the ?filter= query param into a concrete
//{startDate, now} range ("all" goes back 100 years - effectively "everything")
function getDateRangeFromRequest(req) {
	const { filter = "month" } = req.query;

	const now = new Date();
	const startDate = new Date();
	if (filter === "week") startDate.setDate(startDate.getDate() - 7);
	else if (filter === "month") startDate.setDate(startDate.getDate() - 30);
	else if (filter === "year") startDate.setDate(startDate.getDate() - 365);
	else startDate.setFullYear(startDate.getFullYear() - 100); //"all"

	return { startDate, now };
}

async function getBiggestChanges(req, res) {
	const user_id = req.user_id;
	const { startDate, now } = getDateRangeFromRequest(req);

	const changes = await service.getBiggest5Changes(user_id, startDate, now);
	return res.status(200).json({ changes });
}

async function getLoggedLifts(req, res) {
	const user_id = req.user_id;
	const { startDate, now } = getDateRangeFromRequest(req);

	const lifts = await service.getLoggedLifts(user_id, startDate, now);
	return res.status(200).json({ lifts });
}

async function getExerciseHistory(req, res) {
	const catalog_id = req.params.id;
	const user_id = req.user_id;
	const { startDate, now } = getDateRangeFromRequest(req);

	const history = await service.exerciseOverTime(user_id, startDate, now, catalog_id);
	return res.status(200).json(history);
}

//e.g. /workouts/exercise-stats?catalog_ids=1,4,7&exclude_workout_id=28
//catalog_ids comes in as one string ("1,4,7"), so split it into numbers ourselves.
//exclude_workout_id is the workout being edited - leave it off for a new workout.
async function getExerciseStats(req, res) {
	const { catalog_ids = "", exclude_workout_id } = req.query;

	const catalogIds = [
		...new Set(
			String(catalog_ids)
				.split(",")
				.map(Number)
				.filter((id) => Number.isInteger(id) && id > 0), //drops junk like "abc" or the "" from an empty param
		),
	];
	if (catalogIds.length === 0) return res.status(400).json({ message: "catalog_ids must be a comma separated list of ids" });
	if (catalogIds.length > 50) return res.status(400).json({ message: "Too many catalog_ids (max 50)" });

	let excludeWorkoutId = null;
	if (exclude_workout_id !== undefined) {
		excludeWorkoutId = Number(exclude_workout_id);
		if (!Number.isInteger(excludeWorkoutId) || excludeWorkoutId <= 0) return res.status(400).json({ message: "exclude_workout_id must be a workout id" });
	}

	const stats = await service.getExerciseStats(req.user_id, catalogIds, excludeWorkoutId);
	return res.status(200).json({ stats });
}

async function getVolumeByMuscleGroup(req, res) {
	const user_id = req.user_id;
	const { startDate, now } = getDateRangeFromRequest(req);

	const volume = await service.getVolumeByMuscleGroup(user_id, startDate, now);
	return res.status(200).json(volume);
}

async function createCatalogExercise(req, res) {
	/*
	{
		name: "Bench Press",
		muscle_group: "chest"
	}
	*/
	let exercise = await service.CreateCatalogExercise(req.body);
	return res.status(200).json({ exercise });
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
	getLoggedLifts,
	getExerciseHistory,
	getVolumeByMuscleGroup,
	getExerciseStats,
};
