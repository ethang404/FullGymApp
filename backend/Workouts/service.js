const WorkoutsModel = require("../models/modelInits").workouts;
const ExercisesModel = require("../models/modelInits").exercises;
const SetsModel = require("../models/modelInits").sets;
const UsersModel = require("../models/modelInits").users;
const ExerciseCatalogModel = require("../models/modelInits").exercise_catalog;

const { Op, QueryTypes } = require("sequelize");
const sequelize = require("../models/db");

const { GeneralError, NotFoundError, DataError } = require("../error");
const { serializeWorkoutListItem, serializeWorkout } = require("../serializers/workouts");
const { findOwned } = require("../utils/ownership");
const { assertOneOf } = require("../utils/validate");
const { isValidTimestamp } = require("../utils/dates");

const WORKOUT_FILTERS = ["all", "week", "month", "year"];

const exerciseInclude = {
	model: ExercisesModel,
	include: [
		{
			model: SetsModel,
		},
		{
			model: ExerciseCatalogModel,
			attributes: ["catalog_id", "name", "muscle_group"],
		},
	],
};

async function validateCatalogExercise(catalog_id, t) {
	const catalogEntry = await ExerciseCatalogModel.findOne({
		where: { catalog_id: catalog_id, is_deleted: false },
		transaction: t,
	});
	if (!catalogEntry) throw new NotFoundError(`No active catalog exercise found with id ${catalog_id}`);
	return catalogEntry;
}

//exercises and sets must be arrays (empty is fine) - edit deletes anything missing from them, so a missing list would wipe the workout
function assertExercisesShape(data) {
	if (!Array.isArray(data.exercises)) throw new DataError("exercises must be an array");
	for (let exercise of data.exercises) {
		if (!Array.isArray(exercise.sets)) throw new DataError("Each exercise needs a sets array");
	}
}

//list shape (serializeWorkoutListItem) - ready to send
async function GetWorkouts(user_id, filter = "all") {
	let workouts;
	let now = new Date();
	let startDate = new Date();

	assertOneOf(filter, WORKOUT_FILTERS, "filter");

	if (filter == "all") {
		workouts = await WorkoutsModel.findAll({
			where: { user_id: user_id },
			include: [exerciseInclude],
			order: [
				[ExercisesModel, "order_number", "ASC"],
				[ExercisesModel, SetsModel, "order_number", "ASC"],
			],
		});
		return workouts.map(serializeWorkoutListItem);
	} else if (filter == "week") startDate.setDate(startDate.getDate() - 7);
	else if (filter == "month") startDate.setDate(startDate.getDate() - 30);
	else if (filter == "year") startDate.setDate(startDate.getDate() - 365);

	workouts = await WorkoutsModel.findAll({
		where: { workout_date: { [Op.between]: [startDate, now] }, user_id: user_id },
		include: [exerciseInclude],
		order: [
			[ExercisesModel, "order_number", "ASC"],
			[ExercisesModel, SetsModel, "order_number", "ASC"],
		],
	});
	return workouts.map(serializeWorkoutListItem);
}

async function GetWorkout(workout_id, user_id) {
	const workout = await findOwned(WorkoutsModel, workout_id, user_id, "Workout", {
		include: [exerciseInclude],
		order: [
			[ExercisesModel, "order_number", "ASC"],
			[ExercisesModel, SetsModel, "order_number", "ASC"],
		],
	});
	return serializeWorkout(workout); //editor shape - same one POST/PUT accept
}

async function CreateWorkout(data, user_id) {
	assertExercisesShape(data);
	return await sequelize.transaction(async (t) => {
		//createWorkout
		const user = await UsersModel.findOne({ where: { user_id: user_id }, transaction: t });
		if (!user) throw new GeneralError("No user found or authentication expired"); //this shouldn't even hit

		if (!data.workout_name || !data.workout_date) throw new DataError("Workout Name and Workout Date required");
		if (data.started_at != null && !isValidTimestamp(data.started_at)) throw new DataError("started_at must be an ISO date and time");

		var workout = await user.createWorkout(
			{
				name: data.workout_name,
				workout_date: data.workout_date,
				notes: data.notes,
				started_at: data.started_at,
				finished_at: data.finished_at,
			},
			{ transaction: t },
		);

		//create exercises
		for (let exercise of data.exercises) {
			if (!exercise.catalog_id) throw new DataError("catalog_id is required for each exercise");
			await validateCatalogExercise(exercise.catalog_id, t);

			const newExercise = await workout.createExercise(
				{
					catalog_id: exercise.catalog_id,
					notes: exercise.notes,
					order_number: exercise.order_number,
				},
				{ transaction: t },
			);

			for (let set of exercise.sets) {
				await newExercise.createSet(
					{
						notes: set.notes,
						reps: set.reps,
						weight: set.weight,
						reps_in_reserve: set.reps_in_reserve,
						duration_seconds: set.duration_seconds,
						distance: set.distance,
						set_type: set.set_type, //"warmup" vs "working" etc.
						order_number: set.order_number, //order of sets (1-x)
					},
					{ transaction: t },
				);
			}
		}

		return workout;
	});
}

async function EditWorkout(data, workout_id, user_id) {
	assertExercisesShape(data); //before the transaction - nothing gets deleted on a bad body
	return await sequelize.transaction(async (t) => {
		let workout_obj = await findOwned(WorkoutsModel, workout_id, user_id, "Workout", { transaction: t });
		if (data.started_at != null && !isValidTimestamp(data.started_at)) throw new DataError("started_at must be an ISO date and time");

		await workout_obj.update(
			{
				name: data.workout_name,
				workout_date: data.workout_date,
				notes: data.notes,
				started_at: data.started_at,
				finished_at: data.finished_at,
			},
			{ transaction: t },
		);

		//grab list of exercises/sets for a workout stored in database.
		//also loop over each exercise/set for a workout provided in data

		//if we have exercise/set_id not found in database (found in data), add it to database

		//if we have exercise/set_id in database that isn't in workout, remove it from database

		const exercisesList = await ExercisesModel.findAll({
			where: { workout_id: workout_id },
			include: SetsModel,
			transaction: t,
		});
		//cast exercises and sets into a map
		let javascriptArray = exercisesList.map((exercise) => exercise.toJSON());

		//If object in database but not in passed data: remove
		for (let dbExercise of javascriptArray) {
			//if exercise id in database not found in data: remove
			let shouldExist = data.exercises.some((exercise) => exercise.exercise_id === dbExercise.exercise_id);
			if (!shouldExist) {
				await ExercisesModel.destroy({ where: { exercise_id: dbExercise.exercise_id }, transaction: t });
			} else {
				//now check each set id of each exercise we DIDN'T REMOVE to see if it should exist
				let exerciseSets = data.exercises.find((exercise) => exercise.exercise_id === dbExercise.exercise_id);
				for (let dbSet of dbExercise.sets) {
					shouldExist = exerciseSets.sets.some((set) => set.set_id === dbSet.set_id);
					if (!shouldExist) {
						await SetsModel.destroy({
							where: { set_id: dbSet.set_id, exercise_id: dbExercise.exercise_id },
							transaction: t,
						});
					}
				}
			}
		}

		for (let exercise of data.exercises) {
			//scoped to THIS workout - an exercise_id from someone else's workout is treated like a new exercise, never edited
			let exercise_obj = exercise.exercise_id
				? await ExercisesModel.findOne({ where: { exercise_id: exercise.exercise_id, workout_id: workout_obj.workout_id }, transaction: t })
				: null;

			if (exercise_obj == null) {
				//we have a new exercise
				if (!exercise.catalog_id) throw new DataError("catalog_id is required for each new exercise");
				await validateCatalogExercise(exercise.catalog_id, t);

				let newExercise = await workout_obj.createExercise(
					{
						catalog_id: exercise.catalog_id,
						notes: exercise.notes,
						order_number: exercise.order_number,
					},
					{ transaction: t },
				);

				//create corresponding new sets for newly added exercise
				for (let set of exercise.sets) {
					await newExercise.createSet(
						{
							set_type: set.set_type,
							order_number: set.order_number,
							notes: set.notes,
							reps: set.reps,
							weight: set.weight,
							reps_in_reserve: set.reps_in_reserve,
							duration_seconds: set.duration_seconds,
							distance: set.distance,
						},
						{ transaction: t },
					);
				}
			} else {
				//existing exercise to update
				let updateData = {
					order_number: exercise.order_number,
					notes: exercise.notes,
				};

				// catalog_id is optional on update - only touch/validate it if the client actually sent one
				if (exercise.catalog_id) {
					await validateCatalogExercise(exercise.catalog_id, t);
					updateData.catalog_id = exercise.catalog_id;
				}

				await exercise_obj.update(updateData, { transaction: t });

				//loop over data exercise's sets to update/add
				for (let set of exercise.sets) {
					//same idea - only sets that belong to this exercise can be edited
					let set_obj = set.set_id ? await SetsModel.findOne({ where: { set_id: set.set_id, exercise_id: exercise_obj.exercise_id }, transaction: t }) : null;
					if (set_obj == null) {
						//we have a new set for exercise
						await exercise_obj.createSet(
							{
								set_type: set.set_type,
								order_number: set.order_number,
								notes: set.notes,
								reps: set.reps,
								weight: set.weight,
								reps_in_reserve: set.reps_in_reserve,
								duration_seconds: set.duration_seconds,
								distance: set.distance,
							},
							{ transaction: t },
						);
					} else {
						await set_obj.update(
							{
								set_type: set.set_type,
								order_number: set.order_number,
								notes: set.notes,
								reps: set.reps,
								weight: set.weight,
								reps_in_reserve: set.reps_in_reserve,
								duration_seconds: set.duration_seconds,
								distance: set.distance,
							},
							{ transaction: t },
						);
					}
				}
			}
		}

		//lets return entire workout object, that makes more sense than exercise list
		const workout_modified = await WorkoutsModel.findByPk(workout_id, {
			include: [exerciseInclude],
			order: [
				[ExercisesModel, "order_number", "ASC"],
				[ExercisesModel, SetsModel, "order_number", "ASC"],
			],
			transaction: t,
		});
		return workout_modified;
	});
}

async function DeleteWorkout(workout_id, user_id) {
	const workout = await findOwned(WorkoutsModel, workout_id, user_id, "Workout");
	await workout.destroy();
}

//Add function to add/search to exercise catalog, don't care about edit/delete right now. Don't want just any user doing that.

// /catalog?search=press&muscle_group=chest
async function SearchCatalogExercises({ search, muscle_group } = {}) {
	const where = { is_deleted: false };

	if (muscle_group) where.muscle_group = muscle_group;
	if (search) where.name = { [Op.iLike]: `%${search}%` };

	return await ExerciseCatalogModel.findAll({
		where,
		order: [["name", "ASC"]],
	});
}

// /catalog: { name, muscle_group }
async function CreateCatalogExercise(data) {
	if (!data.name || !data.muscle_group) throw new DataError("name and muscle_group are required");

	const existing = await ExerciseCatalogModel.findOne({
		where: { name: { [Op.iLike]: data.name } },
	});

	if (existing) {
		if (!existing.is_deleted) throw new DataError(`An exercise named "${data.name}" already exists in the catalog`);
		//if name matches a soft-deleted entry - restore it instead of creating a duplicate row
		return await existing.update({ muscle_group: data.muscle_group, is_deleted: false });
	}

	//otherwise just create new
	return await ExerciseCatalogModel.create({
		name: data.name,
		muscle_group: data.muscle_group,
	});
}

//---------------
//These endpoints below will be for fetching data for various metrics/displays on progress

//estimated 1RM (Epley) off the heaviest qualifying working set for an exercise instance
//basically evaluates how strong you are on that exercise on that day
//weight × (1 + reps / 30)

function getExerciseE1RM(exercise) {
	return getBestWorkingSet(exercise.sets ?? [])?.e1rm ?? null;
}

//given a flat list of sets (can be merged across multiple exercise entries for the same day), find the
//best "working" set by estimated 1RM (Epley) and return its weight/reps/e1rm - or null if none qualify
//tries to account for reps in reserve
function getBestWorkingSet(sets) {
	let best = null;
	for (const set of sets ?? []) {
		if (set.set_type !== "working" || !set.reps || !set.weight) continue;
		const reps_in_reserve = set.reps_in_reserve ?? 0;
		const effective_reps = set.reps + reps_in_reserve;
		const e1rm = set.weight * (1 + effective_reps / 30);
		if (best === null || e1rm > best.e1rm) best = { weight: set.weight, reps: set.reps, reps_in_reserve, e1rm };
	}
	return best;
}

//every workout (with exercises, sets and catalog info) a user logged in a date range, oldest first
async function getWorkoutsInRange(user_id, start_date, end_date) {
	return await WorkoutsModel.findAll({
		where: {
			user_id,
			workout_date: {
				[Op.between]: [start_date, end_date],
			},
		},
		include: [exerciseInclude],
		order: [
			["workout_date", "ASC"],
			[ExercisesModel, "order_number", "ASC"],
			[ExercisesModel, SetsModel, "order_number", "ASC"],
		],
	});
}

//Biggest increases/decreases in lifts % across a given timeframe (keep consistent order_number since changing that would increase/decrease fatigue)
async function getBiggest5Changes(user_id, start_date, end_date) {
	//across all workouts for a user, look at exercises (+ w/ consistent order number), look at weight/reps to find biggest % changes

	const full_data = await getWorkoutsInRange(user_id, start_date, end_date);

	//group occurrences of the same lift (catalog_id) across workouts, in chronological order
	const occurrencesByCatalogId = new Map();

	for (const workout of full_data) {
		for (const exercise of workout.exercises ?? []) {
			const value = getExerciseE1RM(exercise);
			if (value === null) continue; //no qualifying working sets, can't use this occurrence

			const catalog = exercise.exercise_catalog;
			const record = {
				catalog_id: catalog.catalog_id,
				name: catalog.name,
				muscle_group: catalog.muscle_group,
				order_number: exercise.order_number,
				workout_date: workout.workout_date,
				value,
			};

			if (!occurrencesByCatalogId.has(record.catalog_id)) occurrencesByCatalogId.set(record.catalog_id, []);

			occurrencesByCatalogId.get(record.catalog_id).push(record);
		}
	}

	//occurrencesByCatalogId => catalog_id1: [bench1, bench2], catalog_id2: [leg1, leg2]
	//[0] is first, [-1] is latest of an catalog_id's exercise. (bench2 is latest)

	const changes = [];

	for (const occurrences of occurrencesByCatalogId.values()) {
		if (occurrences.length < 2) continue; //need at least 2 points in range to compare

		const first = occurrences[0];
		const last = occurrences[occurrences.length - 1];

		if (first.order_number !== last.order_number) continue; //position changed, skip to avoid fatigue bias
		if (!first.value) continue; //avoid divide-by-zero / meaningless %

		changes.push({
			catalog_id: first.catalog_id,
			name: first.name,
			muscle_group: first.muscle_group,
			first_value: first.value,
			last_value: last.value,
			first_date: first.workout_date,
			last_date: last.workout_date,
			percent_change: ((last.value - first.value) / first.value) * 100,
		});
	}

	changes.sort((a, b) => Math.abs(b.percent_change) - Math.abs(a.percent_change));

	return changes.slice(0, 5);
}

//Every lift the user has a qualifying working set for in the range - feeds the lift picker on the progress page.
//Most-trained lifts first, since those are the ones with enough points to chart.
async function getLoggedLifts(user_id, start_date, end_date) {
	const full_data = await getWorkoutsInRange(user_id, start_date, end_date);

	//catalog_id -> { catalog_id, name, muscle_group, dates: Set<workout_date>, last_date }
	const liftsById = new Map();

	for (const workout of full_data) {
		for (const exercise of workout.exercises ?? []) {
			if (getExerciseE1RM(exercise) === null) continue; //nothing chartable logged for this lift that day

			const catalog = exercise.exercise_catalog;
			if (!liftsById.has(catalog.catalog_id)) {
				liftsById.set(catalog.catalog_id, {
					catalog_id: catalog.catalog_id,
					name: catalog.name,
					muscle_group: catalog.muscle_group,
					dates: new Set(),
				});
			}
			const lift = liftsById.get(catalog.catalog_id);
			lift.dates.add(workout.workout_date); //same lift twice in one workout still counts as one session
			lift.last_date = workout.workout_date; //workouts come back oldest first, so the last write wins
		}
	}

	return [...liftsById.values()]
		.map(({ dates, ...lift }) => ({ ...lift, session_count: dates.size }))
		.sort((a, b) => b.session_count - a.session_count || a.name.localeCompare(b.name));
}

//One point per workout for a single lift: that day's best working set (by e1RM), with its weight, reps and
//e1RM all included so the frontend can switch between e1RM-over-time, weight-over-time and weight-vs-reps
//charts without refetching.
async function exerciseOverTime(user_id, start_date, end_date, catalog_id) {
	const exerciseIncludeCatalogId = {
		model: ExercisesModel,
		where: {
			catalog_id,
		},
		include: [
			{
				model: SetsModel,
			},
			{
				model: ExerciseCatalogModel,
				attributes: ["catalog_id", "name", "muscle_group"],
			},
		],
	};

	const full_data = await WorkoutsModel.findAll({
		where: {
			user_id,
			workout_date: {
				[Op.between]: [start_date, end_date],
			},
		},
		include: [exerciseIncludeCatalogId],
		order: [
			["workout_date", "ASC"],
			[ExercisesModel, "order_number", "ASC"],
			[ExercisesModel, SetsModel, "order_number", "ASC"],
		],
	});

	let name = null;
	let muscle_group = null;
	const data = [];

	for (const workout of full_data) {
		const exercises = workout.exercises ?? [];
		if (exercises.length === 0) continue; //no matching exercise this workout (inner join should prevent this, but just in case)

		if (name === null) {
			//grab display info once, from the first occurrence we see
			name = exercises[0].exercise_catalog.name;
			muscle_group = exercises[0].exercise_catalog.muscle_group;
		}

		//merges sets of duplicate exercise (bench logged twice in one workout)
		//finds best working set for that exercise for that workout (strongest)
		const combinedSets = exercises.flatMap((exercise) => exercise.sets ?? []);
		const bestSet = getBestWorkingSet(combinedSets);
		if (bestSet === null) continue; //no qualifying working sets logged that day

		data.push({
			date: workout.workout_date,
			weight: bestSet.weight,
			reps: bestSet.reps,
			reps_in_reserve: bestSet.reps_in_reserve,
			e1rm: bestSet.e1rm,
		});
	}

	return { catalog_id: Number(catalog_id), name, muscle_group, data };
}

//Working sets and working-set reps per muscle group. Sets drive the pie chart (sets per muscle group is the
//usual way to measure training volume), reps sit next to them in the bar chart. Muscle groups with nothing
//logged are left out so the charts don't fill up with empty slices/bars.
async function getVolumeByMuscleGroup(user_id, start_date, end_date) {
	const full_data = await getWorkoutsInRange(user_id, start_date, end_date);

	//muscle_group -> { sets, reps }
	const volumeByGroup = new Map();

	for (const workout of full_data) {
		for (const exercise of workout.exercises ?? []) {
			const muscle_group = exercise.exercise_catalog.muscle_group;
			for (const set of exercise.sets ?? []) {
				if (set.set_type !== "working" || !set.reps) continue; //a working set with no reps logged is a blank row, not a set
				if (!volumeByGroup.has(muscle_group)) volumeByGroup.set(muscle_group, { sets: 0, reps: 0 });
				const group = volumeByGroup.get(muscle_group);
				group.sets += 1;
				group.reps += set.reps;
			}
		}
	}

	let total_sets = 0;
	let total_reps = 0;
	for (const { sets, reps } of volumeByGroup.values()) {
		total_sets += sets;
		total_reps += reps;
	}

	const breakdown = [...volumeByGroup.entries()]
		.map(([muscle_group, { sets, reps }]) => ({
			muscle_group,
			sets,
			reps,
			percent_of_sets: (sets / total_sets) * 100, //total_sets > 0 whenever there's a breakdown row
		}))
		.sort((a, b) => b.sets - a.sets || b.reps - a.reps);

	return { total_sets, total_reps, breakdown };
}

//NOTE: These queries don't account for order_number for fatigue on an exercise
//Only set's previous query takes in account order_number for returning items for a given exercise
//But TLDR fatigue for an exercise's order is never accounted for. Could fix by adding workout name?

//Shared filters for "which past workouts count" when logging a workout. Both stats queries use these so
//best and previous always look at the same workouts:
//  - only this user's, only finished ones (a half-done workout from earlier today isn't "previous")
//  - never the workout being edited (otherwise it shows its own sets as previous)
//  - only workouts on/before the one being edited (editing an old workout shouldn't show newer ones)
const PAST_WORKOUT_FILTERS = `
	w.user_id = :userId
	AND w.finished_at IS NOT NULL
	AND w.workout_id <> :excludeWorkoutId
	AND (CAST(:beforeDate AS DATE) IS NULL OR w.workout_date <= CAST(:beforeDate AS DATE))
`;

//Heaviest working set per catalog exercise, all in one query (GROUP BY = one row per catalog_id)
const BEST_WEIGHT_SQL = `
	SELECT e.catalog_id, MAX(s.weight) AS best_weight
	FROM sets s
	JOIN exercises e ON e.exercise_id = s.exercise_id
	JOIN workouts w ON w.workout_id = e.workout_id
	WHERE ${PAST_WORKOUT_FILTERS}
	  AND e.catalog_id IN (:catalogIds)
	  AND s.set_type = 'working'
	  AND s.weight IS NOT NULL
	GROUP BY e.catalog_id
`;

//Sets from the most recent time this catalog exercise was done. Inner query picks the exercise,
//outer query gets its sets. One catalog_id per run (LIMIT 1 = one row total, not one per exercise).
const PREVIOUS_SETS_SQL = `
	SELECT set_type, weight, reps, reps_in_reserve, order_number
	FROM sets
	WHERE exercise_id = (
		SELECT e.exercise_id
		FROM exercises e
		JOIN workouts w ON w.workout_id = e.workout_id
		WHERE ${PAST_WORKOUT_FILTERS}
		  AND e.catalog_id = :catalogId
		ORDER BY w.workout_date DESC, w.finished_at DESC, e.order_number ASC
		LIMIT 1
	)
	ORDER BY order_number
`;

//Best weight + last session's sets for each catalog exercise, for the prev/best columns while logging.
//exclude_workout_id is the workout being edited (null for a new workout) - it's skipped, and only workouts
//on or before its date count. Always the logged-in user's history.
async function getExerciseStats(user_id, catalog_ids, exclude_workout_id = null) {
	let beforeDate = null;
	if (exclude_workout_id) {
		const current = await WorkoutsModel.findOne({ where: { workout_id: exclude_workout_id, user_id }, attributes: ["workout_date"] });
		if (!current) throw new NotFoundError("No workout found with that workout ID");
		beforeDate = current.workout_date;
	}

	const filters = { userId: user_id, excludeWorkoutId: exclude_workout_id ?? 0, beforeDate };

	const bestRows = await sequelize.query(BEST_WEIGHT_SQL, {
		replacements: { ...filters, catalogIds: catalog_ids },
		type: QueryTypes.SELECT,
	});

	//one query per exercise, all running at once - fine for the handful of exercises in a workout
	const previousPerExercise = await Promise.all(
		catalog_ids.map((catalogId) =>
			sequelize.query(PREVIOUS_SETS_SQL, {
				replacements: { ...filters, catalogId },
				type: QueryTypes.SELECT,
			}),
		),
	);

	//raw queries return DECIMAL as a string (same reason sets.weight has a getter)
	const toNumber = (value) => (value == null ? null : parseFloat(value));

	//catalog_id -> { best_weight, previous_sets }. Every requested id gets an entry, even with no history.
	const stats = {};
	catalog_ids.forEach((catalogId, i) => {
		stats[catalogId] = {
			best_weight: null,
			previous_sets: previousPerExercise[i].map((set) => ({ ...set, weight: toNumber(set.weight) })),
		};
	});
	for (const row of bestRows) stats[row.catalog_id].best_weight = toNumber(row.best_weight);

	return stats;
}

module.exports = {
	GetWorkouts,
	GetWorkout,
	CreateWorkout,
	EditWorkout,
	DeleteWorkout,
	SearchCatalogExercises,
	CreateCatalogExercise,
	getBiggest5Changes,
	getLoggedLifts,
	exerciseOverTime,
	getVolumeByMuscleGroup,
	getExerciseStats,
	getWorkoutsInRange, //Friends overview
};
