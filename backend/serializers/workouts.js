//Shapes workout rows for the frontend. Called from the services (Workouts GetWorkouts/GetWorkout, Friends overview),
//so your own workouts, a friend's and a shared post's all come back identical. Leaf module - requires nothing.
//Both take a Sequelize instance (they call .toJSON()), with exercises -> exercise_catalog + sets included.

//longer than this almost always means the editor was left open (forgot to finish, or a draft resumed the
//next day), not a real session - showing "840 min" is worse than showing nothing
const MAX_DURATION_MINUTES = 6 * 60;

//helper function to serialze some data for frontend use
function serializeWorkoutListItem(workout) {
	const w = workout.toJSON();
	const allSets = (w.exercises ?? []).flatMap((e) => e.sets ?? []);

	const totalVolumeKg = allSets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);

	//both are exact moments in time, so the subtraction is right in any time zone. No duration (undefined,
	//which the frontend hides) when either is missing or the result is under a minute / over the cap
	let durationMinutes;
	if (w.started_at && w.finished_at) {
		const minutes = Math.round((new Date(w.finished_at) - new Date(w.started_at)) / 60000);
		if (minutes >= 1 && minutes <= MAX_DURATION_MINUTES) durationMinutes = minutes;
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

//One workout in the same shape POST/PUT /workouts accept (workout_name, exercise_name), so the frontend can
//load it, edit it, and send it straight back without renaming anything. Null notes become "" for text boxes.
function serializeWorkout(workout) {
	const w = workout.toJSON();
	return {
		workout_id: w.workout_id,
		user_id: w.user_id,
		workout_name: w.name ?? "",
		workout_date: w.workout_date,
		notes: w.notes ?? "",
		created_at: w.createdAt, //Sequelize keeps timestamps camelCase on the object even with underscored: true (the column is created_at)
		started_at: w.started_at,
		finished_at: w.finished_at,
		exercises: (w.exercises ?? []).map((e) => ({
			exercise_id: e.exercise_id,
			catalog_id: e.catalog_id,
			exercise_name: e.exercise_catalog?.name ?? "",
			notes: e.notes ?? "",
			order_number: e.order_number,
			sets: (e.sets ?? []).map((s) => ({
				set_id: s.set_id,
				order_number: s.order_number,
				set_type: s.set_type,
				notes: s.notes ?? "",
				weight: s.weight,
				reps: s.reps,
				reps_in_reserve: s.reps_in_reserve,
				duration_seconds: s.duration_seconds,
				distance: s.distance,
			})),
		})),
	};
}

module.exports = { serializeWorkoutListItem, serializeWorkout };
