const WorkoutsModel = require("../models/modelInits").workouts;
const ExercisesModel = require("../models/modelInits").exercises;
const SetsModel = require("../models/modelInits").sets;
const UsersModel = require("../models/modelInits").users;
const ExerciseCatalogModel = require("../models/modelInits").exercise_catalog;

const { Op } = require("sequelize");
const sequelize = require("../models/db");

const { GeneralError, NotFoundError, DataError, UnauthorizedError, ForbiddenError } = require("../error");

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

async function validateCatalogExercise(catalog_id) {
	const catalogEntry = await ExerciseCatalogModel.findOne({
		where: { catalog_id: catalog_id, is_deleted: false },
	});
	if (!catalogEntry) throw new NotFoundError(`No active catalog exercise found with id ${catalog_id}`);
	return catalogEntry;
}

async function GetWorkouts(user_id, filter = "all") {
	let workouts;
	let now = new Date();
	let startDate = new Date();

	if (filter == "all")
		return await WorkoutsModel.findAll({
			where: { user_id: user_id },
			include: [exerciseInclude],
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
		include: [exerciseInclude],
		order: [
			[ExercisesModel, "order_number", "ASC"],
			[ExercisesModel, SetsModel, "order_number", "ASC"],
		],
	});
	return workouts;
}

async function GetWorkout(workout_id) {
	const workout = await WorkoutsModel.findByPk(workout_id, {
		include: [exerciseInclude],
		order: [
			[ExercisesModel, "order_number", "ASC"],
			[ExercisesModel, SetsModel, "order_number", "ASC"],
		],
	});

	if (!workout) throw new NotFoundError("No workout found with that workout ID");
	return workout;
}

async function CreateWorkout(data, user_id) {
	return await sequelize.transaction(async (t) => {
		//createWorkout
		const user = await UsersModel.findOne({ where: { user_id: user_id }, transaction: t });
		if (!user) throw new GeneralError("No user found or authentication expired"); //this shouldn't even hit

		if (!data.workout_name || !data.workout_date) throw new DataError("Workout Name and Workout Date required");

		var workout = await user.createWorkout(
			{
				name: data.workout_name,
				workout_date: data.workout_date,
				notes: data.notes,
				finished_at: data.finished_at,
			},
			{ transaction: t },
		);

		//create exercises
		for (let exercise of data.exercises) {
			if (!exercise.catalog_id) throw new DataError("catalog_id is required for each exercise");
			await validateCatalogExercise(exercise.catalog_id, t);

			let newExercise;
			newExercise = await workout.createExercise(
				{
					catalog_id: exercise.catalog_id,
					notes: exercise.notes,
					order_number: exercise.order_number,
				},
				{ transaction: t },
			);

			if (newExercise) console.log(`Created new exercise with id ${newExercise.exercise_id} (catalog_id ${exercise.catalog_id})`);

			for (let set of exercise.sets) {
				let newSet;
				newSet = await newExercise.createSet(
					{
						notes: set.notes,
						reps: set.reps,
						weight: set.weight,
						duration_seconds: set.duration_seconds,
						distance: set.distance,
						set_type: set.set_type, //"warmup" vs "working" etc.
						order_number: set.order_number, //order of sets (1-x)
					},
					{ transaction: t },
				);

				if (newExercise) console.log(`Created new set with id ${newSet.set_id} (for ${exercise.exercise_id})`);
			}
		}

		return workout;
	});
}

async function EditWorkout(data, workout_id) {
	return await sequelize.transaction(async (t) => {
		let workout_obj = await WorkoutsModel.findByPk(workout_id, { transaction: t });
		if (!workout_obj) throw new NotFoundError("No workout found with that id"); // checked before .update() so a bad id throws this instead of a raw TypeError

		let workout = await workout_obj.update(
			{
				name: data.workout_name,
				workout_date: data.workout_date,
				notes: data.notes,
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
				console.log(`Removing exercise: ${dbExercise.exercise_id} from database`);
				await ExercisesModel.destroy({ where: { exercise_id: dbExercise.exercise_id }, transaction: t });
			} else {
				//now check each set id of each exercise we DIDN'T REMOVE to see if it should exist
				let exerciseSets = data.exercises.find((exercise) => exercise.exercise_id === dbExercise.exercise_id);
				for (let dbSet of dbExercise.sets) {
					shouldExist = exerciseSets.sets.some((set) => set.set_id === dbSet.set_id);
					if (!shouldExist) {
						console.log(`Removing set: ${dbSet.set_id} from database`);
						await SetsModel.destroy({
							where: { set_id: dbSet.set_id, exercise_id: dbExercise.exercise_id },
							transaction: t,
						});
					}
				}
			}
		}

		for (let exercise of data.exercises) {
			let exercise_obj = exercise.exercise_id ? await ExercisesModel.findByPk(exercise.exercise_id, { transaction: t }) : null;

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

				let updatedExercise = await exercise_obj.update(updateData, { transaction: t });

				//loop over data exercise's sets to update/add
				for (let set of exercise.sets) {
					let set_obj = set.set_id ? await SetsModel.findByPk(set.set_id, { transaction: t }) : null;
					if (set_obj == null) {
						//we have a new set for exercise
						await exercise_obj.createSet(
							{
								set_type: set.set_type,
								order_number: set.order_number,
								notes: set.notes,
								reps: set.reps,
								weight: set.weight,
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

async function DeleteWorkout(workout_id) {
	await WorkoutsModel.destroy({ where: { workout_id: workout_id } });
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
//weight × (1 + 0.0333 × reps)
//maybe add more later

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

function average(values) {
	return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

//canonical list of muscle groups, pulled from the ENUM definition itself so it stays in sync if that ever changes
const MUSCLE_GROUPS = ExerciseCatalogModel.getAttributes().muscle_group.values;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

//rolling 7-day windows anchored to end_date - 0 is the most recent window, 1 is the one before that, etc.
function getRollingWeekIndex(date, end_date) {
	const daysFromEnd = Math.floor((new Date(end_date) - new Date(date)) / MS_PER_DAY);
	return Math.floor(daysFromEnd / 7);
}

//the {week_start, week_end} date range covered by a given rolling week index
function getRollingWeekRange(index, end_date) {
	const week_end = new Date(end_date);
	week_end.setDate(week_end.getDate() - index * 7);
	const week_start = new Date(week_end);
	week_start.setDate(week_start.getDate() - 6);
	return { week_start, week_end };
}

//Biggest increases/decreases in lifts % across a given timeframe (keep consistent order_number since changing that would increase/decrease fatigue)
async function getBiggest5Changes(user_id, start_date, end_date) {
	//across all workouts for a user, look at exercises (+ w/ consistent order number), look at weight/reps to find biggest % changes

	const full_data = await WorkoutsModel.findAll({
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

async function exerciseOverTime(user_id, start_date, end_date, catalog_id, Epley) {
	//given date range, a catalog exercise to get data for, and if we do Epley calc or not

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

		if (Epley) {
			data.push({ date: workout.workout_date, value: bestSet.e1rm });
		} else {
			data.push({ date: workout.workout_date, weight: bestSet.weight, reps: bestSet.reps });
		}
	}

	return { catalog_id, name, muscle_group, data };
}

//Volume per muscle group (total reps across working sets)
async function getVolumeByMuscleGroup(user_id, start_date, end_date) {
	const full_data = await WorkoutsModel.findAll({
		where: {
			user_id,
			workout_date: {
				[Op.between]: [start_date, end_date],
			},
		},
		include: [exerciseInclude],
	});

	const volumeByGroup = new Map(MUSCLE_GROUPS.map((group) => [group, 0]));

	for (const workout of full_data) {
		for (const exercise of workout.exercises ?? []) {
			const muscle_group = exercise.exercise_catalog.muscle_group;
			for (const set of exercise.sets ?? []) {
				if (set.set_type !== "working" || !set.reps) continue;
				volumeByGroup.set(muscle_group, volumeByGroup.get(muscle_group) + set.reps);
			}
		}
	}

	//collapse dict items into an array and get totalSum across them
	const total_volume = [...volumeByGroup.values()].reduce((sum, v) => sum + v, 0);

	//divides each muscle group count  by total to normalize into %
	const breakdown = [...volumeByGroup.entries()]
		.map(([muscle_group, volume]) => ({
			muscle_group,
			volume,
			percent: total_volume ? (volume / total_volume) * 100 : 0,
		}))
		.sort((a, b) => b.volume - a.volume);

	return { total_volume, breakdown };
}

//Within-session fatigue curve, split per exercise since positions are only comparable for the same lift.
//avg e1RM (or raw weight) by order_number position, across every session in range, per catalog_id.
//
//We're supposed to show how fatigue accumulates as you move certain lifts later
//like if bench was 1st, then move it to 4th later on
//But the issue is progressive overload happens and that might pollute our logic so it says 4th position is stronger than 1
//Lets skip this for now and come back to it later and see graphs once we have more data
async function getFatigueCurves(user_id, start_date, end_date, Epley) {
	const full_data = await WorkoutsModel.findAll({
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

	//catalog_id -> { name, muscle_group, positions: Map<order_number, {value, percent_of_best}[]> }
	const exercisesById = new Map();
	const runningBestByExercise = new Map(); //catalog_id -> best value seen strictly before the current occurrence

	//so each exercise (catalog_id), has positions. A position is order_number: best weight/erm
	for (const workout of full_data) {
		for (const exercise of workout.exercises ?? []) {
			const bestSet = getBestWorkingSet(exercise.sets ?? []);
			if (bestSet === null) continue; //no qualifying working sets this occurrence

			const value = Epley ? bestSet.e1rm : bestSet.weight;
			const catalog = exercise.exercise_catalog;

			//first-ever occurrence of this lift has no prior data to compare against, so it trivially
			//normalizes to 100% - everything after is judged against the best seen up to (not including) it
			const baseline = runningBestByExercise.has(catalog.catalog_id) ? runningBestByExercise.get(catalog.catalog_id) : value;
			const percent_of_best = (value / baseline) * 100;
			runningBestByExercise.set(catalog.catalog_id, Math.max(baseline, value));

			if (!exercisesById.has(catalog.catalog_id)) {
				exercisesById.set(catalog.catalog_id, {
					catalog_id: catalog.catalog_id,
					name: catalog.name,
					muscle_group: catalog.muscle_group,
					positions: new Map(),
				});
			}

			const entry = exercisesById.get(catalog.catalog_id);
			if (!entry.positions.has(exercise.order_number)) entry.positions.set(exercise.order_number, []);
			entry.positions.get(exercise.order_number).push({ value, percent_of_best });
		}
	}

	const curves = [];
	for (const { catalog_id, name, muscle_group, positions } of exercisesById.values()) {
		const curve = [...positions.entries()]
			.map(([order_number, entries]) => ({
				order_number,
				avg_value: average(entries.map((e) => e.value)), //plain average, kept for reference/display
				avg_percent_of_best: average(entries.map((e) => e.percent_of_best)), //the fatigue signal, corrected for progressive overload
				sample_size: entries.length, //positions 5+ often have few observations - let the frontend fade/hide those
			}))
			.sort((a, b) => a.order_number - b.order_number);

		curves.push({ catalog_id, name, muscle_group, curve });
	}

	return curves;
}

function classifyVolume(set_count) {
	if (set_count >= 20) return "high";
	if (set_count >= 10) return "moderate";
	return "low";
}

//RP-style weekly volume landmarks: working-set count per muscle group per rolling 7-day window,
//classified high (20+) / moderate (10-19) / low (<10). Every week + muscle group is included, even at 0.
async function getWeeklyVolumeLandmarks(user_id, start_date, end_date) {
	const full_data = await WorkoutsModel.findAll({
		where: {
			user_id,
			workout_date: {
				[Op.between]: [start_date, end_date],
			},
		},
		include: [exerciseInclude],
	});

	//rollingWeekIndex -> Map<muscle_group, set_count>
	//each week stores several muscle_groups and corresponding set counts
	const setsByWeek = new Map();

	for (const workout of full_data) {
		const weekIndex = getRollingWeekIndex(workout.workout_date, end_date);
		if (!setsByWeek.has(weekIndex)) setsByWeek.set(weekIndex, new Map(MUSCLE_GROUPS.map((group) => [group, 0])));
		const weekCounts = setsByWeek.get(weekIndex);

		for (const exercise of workout.exercises ?? []) {
			const muscle_group = exercise.exercise_catalog.muscle_group;
			for (const set of exercise.sets ?? []) {
				if (set.set_type !== "working") continue;
				weekCounts.set(muscle_group, weekCounts.get(muscle_group) + 1);
			}
		}
	}

	//Same reasoning as getTrainingFrequency: bound to the oldest week with real data, not the full requested range.
	const maxWeekIndex = setsByWeek.size ? Math.max(...setsByWeek.keys()) : -1;
	const weeks = [];

	for (let index = 0; index <= maxWeekIndex; index++) {
		const { week_start, week_end } = getRollingWeekRange(index, end_date);
		const weekCounts = setsByWeek.get(index) ?? new Map(MUSCLE_GROUPS.map((group) => [group, 0]));

		const muscle_groups = [...weekCounts.entries()].map(([muscle_group, set_count]) => ({
			muscle_group,
			set_count,
			classification: classifyVolume(set_count),
		}));

		//Results in something like:
		/* muscle_groups = [
			{ muscle_group: "chest", set_count: 4, classification: "low" },
			{ muscle_group: "legs", set_count: 3, classification: "low" },
			{ muscle_group: "back", set_count: 0, classification: "low" },
		]; */

		weeks.push({ week_start, week_end, muscle_groups });
	}

	weeks.reverse(); //oldest week first
	return weeks;
}

//Feed of all-time PR events (new best e1RM for a catalog exercise). Deliberately fetches the user's FULL
//history up to end_date (ignoring start_date as a lower query bound) so a plateau isn't miscounted as a
//"new PR" just because the window starts partway through the user's history - start_date only filters
//which already-computed PR events are returned.
async function getPersonalRecordTimeline(user_id, start_date, end_date) {
	const full_data = await WorkoutsModel.findAll({
		where: {
			user_id,
			workout_date: {
				[Op.lte]: end_date,
			},
		},
		include: [exerciseInclude],
		order: [
			["workout_date", "ASC"],
			[ExercisesModel, "order_number", "ASC"],
			[ExercisesModel, SetsModel, "order_number", "ASC"],
		],
	});

	const runningMax = new Map(); //catalog_id -> best e1rm seen so far
	const prEvents = [];

	for (const workout of full_data) {
		for (const exercise of workout.exercises ?? []) {
			const value = getExerciseE1RM(exercise);
			if (value === null) continue;

			const catalog = exercise.exercise_catalog;
			const previousBest = runningMax.get(catalog.catalog_id) ?? 0;

			if (value > previousBest) {
				runningMax.set(catalog.catalog_id, value);
				prEvents.push({
					catalog_id: catalog.catalog_id,
					name: catalog.name,
					muscle_group: catalog.muscle_group,
					workout_date: workout.workout_date,
					value,
				});
			}
		}
	}

	return prEvents.filter((event) => new Date(event.workout_date) >= new Date(start_date)).sort((a, b) => new Date(b.workout_date) - new Date(a.workout_date));
}

//Session count per rolling 7-day window - a simple training-consistency/adherence view.
//how many days of the week we train
async function getTrainingFrequency(user_id, start_date, end_date) {
	const workouts = await WorkoutsModel.findAll({
		where: {
			user_id,
			workout_date: {
				[Op.between]: [start_date, end_date],
			},
		},
		attributes: ["workout_date"],
	});

	const countsByWeek = new Map();
	for (const workout of workouts) {
		const weekIndex = getRollingWeekIndex(workout.workout_date, end_date);
		countsByWeek.set(weekIndex, (countsByWeek.get(weekIndex) ?? 0) + 1);
	}

	//Bound the loop to the oldest week that actually has data, not the full requested range - "all" resolves
	//to a 100-year lookback, and looping every week back to a fixed epoch would produce thousands of empty rows.
	const maxWeekIndex = countsByWeek.size ? Math.max(...countsByWeek.keys()) : -1;
	const weeks = [];
	for (let index = 0; index <= maxWeekIndex; index++) {
		const { week_start, week_end } = getRollingWeekRange(index, end_date);
		weeks.push({ week_start, week_end, session_count: countsByWeek.get(index) ?? 0 });
	}

	weeks.reverse(); //oldest week first
	return weeks;
}

//Average session volume (total working-set reps - not weighted by load) and average session duration,
//per rolling 7-day window - shows whether sessions are trending bigger/smaller or longer/shorter over time.
async function getSessionTrends(user_id, start_date, end_date) {
	const full_data = await WorkoutsModel.findAll({
		where: {
			user_id,
			workout_date: {
				[Op.between]: [start_date, end_date],
			},
		},
		include: [exerciseInclude],
	});

	//rollingWeekIndex -> { volumes: [], durations: [], session_count }
	const byWeek = new Map();

	for (const workout of full_data) {
		const weekIndex = getRollingWeekIndex(workout.workout_date, end_date);
		if (!byWeek.has(weekIndex)) byWeek.set(weekIndex, { volumes: [], durations: [], session_count: 0 });
		const bucket = byWeek.get(weekIndex);
		bucket.session_count += 1;

		let volume = 0;
		for (const exercise of workout.exercises ?? []) {
			for (const set of exercise.sets ?? []) {
				if (set.set_type !== "working" || !set.reps) continue;
				volume += set.reps;
			}
		}
		if (volume > 0) bucket.volumes.push(volume);

		if (workout.finished_at && workout.workout_date) {
			const diffMs = new Date(workout.finished_at) - new Date(workout.workout_date);
			if (diffMs > 0) bucket.durations.push(Math.round(diffMs / 60000));
		}
	}

	//Same reasoning as getTrainingFrequency: bound to the oldest week with real data, not the full requested range.
	const maxWeekIndex = byWeek.size ? Math.max(...byWeek.keys()) : -1;
	const weeks = [];
	for (let index = 0; index <= maxWeekIndex; index++) {
		const { week_start, week_end } = getRollingWeekRange(index, end_date);
		const bucket = byWeek.get(index) ?? { volumes: [], durations: [], session_count: 0 };
		weeks.push({
			week_start,
			week_end,
			avg_volume: average(bucket.volumes),
			avg_duration_minutes: average(bucket.durations),
			session_count: bucket.session_count,
		});
	}

	weeks.reverse(); //oldest week first
	return weeks;
}

function classifyRepRange(reps) {
	if (reps <= 5) return "1-5";
	if (reps <= 12) return "6-12";
	return "13+";
}

//% of working sets in each rep range across the date range, pooled over every exercise -
async function getRepRangeDistribution(user_id, start_date, end_date) {
	const full_data = await WorkoutsModel.findAll({
		where: {
			user_id,
			workout_date: {
				[Op.between]: [start_date, end_date],
			},
		},
		include: [exerciseInclude],
	});

	const counts = { "1-5": 0, "6-12": 0, "13+": 0 };

	for (const workout of full_data) {
		for (const exercise of workout.exercises ?? []) {
			for (const set of exercise.sets ?? []) {
				if (set.set_type !== "working" || !set.reps) continue;
				counts[classifyRepRange(set.reps)] += 1;
			}
		}
	}

	const total = Object.values(counts).reduce((sum, v) => sum + v, 0);

	return ["1-5", "6-12", "13+"].map((range) => ({
		range,
		set_count: counts[range],
		percent: total ? (counts[range] / total) * 100 : 0,
	}));
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
	exerciseOverTime,
	getVolumeByMuscleGroup,
	getFatigueCurves,
	getWeeklyVolumeLandmarks,
	getPersonalRecordTimeline,
	getTrainingFrequency,
	getSessionTrends,
	getRepRangeDistribution,
};
