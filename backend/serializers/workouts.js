//Shapes workout rows for the frontend. Called from the services (Workouts GetWorkouts/GetWorkout, Friends overview),
//so your own workouts, a friend's and a shared post's all come back identical. Leaf module - requires nothing.
//Both take a Sequelize instance (they call .toJSON()), with exercises -> exercise_catalog + sets included.

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
