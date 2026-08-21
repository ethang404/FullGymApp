const WorkoutsModel = require("../models/modelInits").workouts;
const ExercisesModel = require("../models/modelInits").exercises;
const SetsModel = require("../models/modelInits").sets;
const UsersModel = require("../models/modelInits").users;
const ExerciseCatalogModel = require("../models/modelInits").exercise_catalog;

const { Op } = require("sequelize");

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

module.exports = { GetWorkouts, GetWorkout, CreateWorkout, EditWorkout, DeleteWorkout, SearchCatalogExercises, CreateCatalogExercise };
