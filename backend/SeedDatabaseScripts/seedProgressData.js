// Seeds one demo user with ~10 weeks of realistic push/pull/legs workout
// history so every /workouts/progress/* analytics endpoint has real signal
// to work with: progressive overload (weight climbs week over week per
// lift), consistent order_number per exercise within its session type
// (required for getBiggest5Changes/getFatigueCurves to detect anything),
// varied rep ranges (populates all 3 rep-range-distribution buckets), and
// reps_in_reserve set on roughly half the working sets (exercises both
// branches of the RIR-adjusted e1RM formula).
//
// Safe to re-run: the user and exercise_catalog rows are found-or-created,
// and workout generation is skipped entirely if this user already has any
// workouts (delete them first if you want to reseed from scratch).
//
// Run with:  cd backend && node SeedDatabaseScripts/seedProgressData.js
//
// Then log in against the running server with:
//   userName: "progress_demo"
//   password: "ProgressDemo123!"
//
// NOTE: backend/IntegrationTests/workout.test.js wipes the whole DB
// (sequelize.sync({force:true}) in beforeAll). Run `npm test` BEFORE this
// script if you want to keep the seeded data around for manual app testing.

require("dotenv").config();
const bcrypt = require("bcrypt");
const { users, workouts, exercise_catalog } = require("../models/modelInits");
const sequelize = require("../models/db");

const SEED_USERNAME = "progress";
const SEED_PASSWORD = "Progress";

const STAPLES = [
	{ name: "Barbell Bench Press", muscle_group: "chest" },
	{ name: "Barbell Row", muscle_group: "back" },
	{ name: "Overhead Press", muscle_group: "shoulders" },
	{ name: "Barbell Curl", muscle_group: "biceps" },
	{ name: "Tricep Pushdown", muscle_group: "triceps" },
	{ name: "Barbell Squat", muscle_group: "legs" },
	{ name: "Hip Thrust", muscle_group: "glutes" },
	{ name: "Plank", muscle_group: "core" },
	{ name: "Burpee", muscle_group: "full_body" },
	{ name: "Rowing Machine", muscle_group: "cardio" },
];

// Fixed order_number per exercise WITHIN its session type. This consistency
// is what lets getBiggest5Changes/getFatigueCurves detect anything at all,
// since both only compare occurrences of the same catalog_id at the same
// order_number. Compounds sit at position 1 (freshest/heaviest), accessories
// later - naturally lighter relative to their own max, giving fatigue curves
// a real within-session signal without any extra bookkeeping.
const SPLIT = {
	push: [
		{ name: "Barbell Bench Press", order_number: 1, reps: [6, 10] },
		{ name: "Overhead Press", order_number: 2, reps: [6, 10] },
		{ name: "Tricep Pushdown", order_number: 3, reps: [10, 15] },
		{ name: "Plank", order_number: 4, reps: [20, 40] },
	],
	pull: [
		{ name: "Barbell Row", order_number: 1, reps: [6, 10] },
		{ name: "Barbell Curl", order_number: 2, reps: [8, 12] },
		{ name: "Rowing Machine", order_number: 3, reps: [20, 40] },
	],
	legs: [
		{ name: "Barbell Squat", order_number: 1, reps: [4, 8] },
		{ name: "Hip Thrust", order_number: 2, reps: [8, 12] },
		{ name: "Burpee", order_number: 3, reps: [12, 20] },
	],
};

const SESSION_ORDER = ["push", "pull", "legs"];

// Starting weight and per-week increment for each barbell/weighted lift.
// Bodyweight/cardio filler exercises (Plank, Rowing Machine) are omitted
// here on purpose - they get weight: null (see seedSetsForExercise).
const BASE_WEIGHT = {
	"Barbell Bench Press": 135,
	"Overhead Press": 65,
	"Tricep Pushdown": 50,
	"Barbell Row": 115,
	"Barbell Curl": 40,
	"Barbell Squat": 155,
	"Hip Thrust": 135,
};
const WEEKLY_INCREMENT = {
	"Barbell Bench Press": 2.5,
	"Overhead Press": 1.25,
	"Tricep Pushdown": 2.5,
	"Barbell Row": 2.5,
	"Barbell Curl": 1.25,
	"Barbell Squat": 5,
	"Hip Thrust": 5,
};

const END_DATE = new Date("2026-08-31T00:00:00");
const WEEKS_BACK = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function randInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toDateOnly(date) {
	return date.toISOString().slice(0, 10);
}

async function ensureUser() {
	let user = await users.findOne({ where: { user_name: SEED_USERNAME } });
	if (user) {
		console.log(`User "${SEED_USERNAME}" already exists (id ${user.user_id}), reusing.`);
		return user;
	}
	const hash = await bcrypt.hash(SEED_PASSWORD + process.env.PEPPER, await bcrypt.genSalt(10));
	user = await users.create({
		first_name: "Progress",
		last_name: "Demo",
		user_name: SEED_USERNAME,
		password: hash,
	});
	console.log(`Created user "${SEED_USERNAME}" (id ${user.user_id}).`);
	return user;
}

async function ensureCatalog() {
	const catalogByName = {};
	for (const staple of STAPLES) {
		const [row] = await exercise_catalog.findOrCreate({
			where: { name: staple.name },
			defaults: staple,
		});
		catalogByName[staple.name] = row;
	}
	console.log(`Catalog ready: ${Object.keys(catalogByName).length} staple exercises.`);
	return catalogByName;
}

// 1-2 warmup sets (lighter, filtered out by every analytics function's
// set_type check) then 3-4 working sets at the session's target weight.
async function seedSetsForExercise(exercise, slot, sessionWeight) {
	const [repMin, repMax] = slot.reps;
	let orderNumber = 1;

	const warmupCount = randInt(1, 2);
	for (let i = 0; i < warmupCount; i++) {
		await exercise.createSet({
			set_type: "warmup",
			weight: sessionWeight > 0 ? Math.round(sessionWeight * 0.5) : null,
			reps: randInt(8, 12),
			order_number: orderNumber++,
		});
	}

	const workingCount = randInt(3, 4);
	for (let i = 0; i < workingCount; i++) {
		// Roughly half the working sets carry a reps_in_reserve value, the
		// rest omit it entirely - exercises both branches of the
		// RIR-adjusted e1RM formula in getBestWorkingSet.
		const repsInReserve = Math.random() < 0.5 ? randInt(1, 4) : null;
		await exercise.createSet({
			set_type: "working",
			weight: sessionWeight > 0 ? sessionWeight : null,
			reps: randInt(repMin, repMax),
			reps_in_reserve: repsInReserve,
			order_number: orderNumber++,
		});
	}
}

async function seedWorkouts(user, catalogByName) {
	let workoutCount = 0;

	for (let weekIndex = WEEKS_BACK - 1; weekIndex >= 0; weekIndex--) {
		const weekEnd = new Date(END_DATE.getTime() - weekIndex * 7 * MS_PER_DAY);
		const weeksFromStart = WEEKS_BACK - 1 - weekIndex; // 0 at oldest week, climbing toward now -> progressive overload

		for (let sessionIdx = 0; sessionIdx < SESSION_ORDER.length; sessionIdx++) {
			const sessionType = SESSION_ORDER[sessionIdx];
			const dayOffset = sessionIdx * 2; // Mon/Wed/Fri-style spacing within the week
			const sessionDate = new Date(weekEnd.getTime() - (6 - dayOffset) * MS_PER_DAY);
			const workoutDate = toDateOnly(sessionDate);

			// NOTE: getSessionTrends (service.js) and serializeWorkoutListItem (controller.js) both compute
			// "duration" as finished_at - workout_date, where workout_date (DATEONLY) parses as UTC midnight.
			// There's no started_at column in the schema, so that's the app's existing (imperfect) convention -
			// flagged separately as a pre-existing gap. To get a plausible-looking duration out of that formula
			// with today's schema, finished_at needs to sit just after UTC midnight of workout_date, not at a
			// realistic local start time (which the DB has no way to record anyway).
			const startTime = new Date(`${workoutDate}T00:00:00.000Z`);
			const finishedAt = new Date(startTime.getTime() + randInt(45, 75) * 60000);

			const workout = await workouts.create({
				user_id: user.user_id,
				name: sessionType.charAt(0).toUpperCase() + sessionType.slice(1) + " Day",
				workout_date: workoutDate,
				finished_at: finishedAt,
			});

			for (const slot of SPLIT[sessionType]) {
				const catalogRow = catalogByName[slot.name];
				const exercise = await workout.createExercise({
					catalog_id: catalogRow.catalog_id,
					order_number: slot.order_number,
				});

				const base = BASE_WEIGHT[slot.name] ?? 0;
				const increment = WEEKLY_INCREMENT[slot.name] ?? 0;
				const sessionWeight = base + increment * weeksFromStart;

				await seedSetsForExercise(exercise, slot, sessionWeight);
			}

			workoutCount++;
		}
	}

	console.log(`Created ${workoutCount} workouts across ${WEEKS_BACK} weeks.`);
}

async function main() {
	try {
		const user = await ensureUser();
		const catalogByName = await ensureCatalog();

		const existingCount = await workouts.count({ where: { user_id: user.user_id } });
		if (existingCount > 0) {
			console.log(`User already has ${existingCount} workouts - skipping workout generation to avoid duplicates.`);
			console.log("Delete existing workouts for this user first if you want to reseed.");
		} else {
			await seedWorkouts(user, catalogByName);
		}

		console.log("Seed complete.");
	} catch (err) {
		console.error("Seed failed:", err);
		process.exitCode = 1;
	} finally {
		await sequelize.close();
	}
}

main();
