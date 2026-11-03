// One script for all the demo data: three users that between them light up every screen in the app.
// (Replaces the old seedProgressData / seedSocialDemo / seedTzatzikiFoods scripts - their data lives here now.)
//
//   ethan / Ethan   the main account. Profile + macro goals filled in, 10 weeks of push/pull/legs history
//                   with progressive overload (Progress tab, prev/best while logging), 3 recipes, 2 weeks of
//                   diary entries (Nutrition tab + date navigation).
//   alice / Alice   second account with a little of everything: 3 workouts, 3 recipes, diary for today and yesterday.
//   bob / Bob       same as Alice - a third account for multi-user testing.
//
// Also seeds the full exercise catalog and every food the users need, including the ingredients for
// https://www.skinnytaste.com/tzatziki/ - so "Import from a link" with that URL matches every ingredient.
//
// Safe to re-run: users/foods are found-or-created, and each user's workouts/recipes/diary are
// skipped if that user already has any. To start these three users over from scratch, pass --fresh: it deletes
// them first (same as deleting the account in the app), then reseeds.
//
// Run with:  cd backend && node SeedDatabaseScripts/seedDemoData.js [--fresh]
// Or on server boot: SEED_DEMO_DATA=true in .env (see models/modelInits.js)
//
// NOTE: backend/IntegrationTests/*.test.js wipe the whole DB (sequelize.sync({force:true}) in beforeAll).
// Run `npm test` BEFORE this script if you want to keep the seeded data around.

require("dotenv").config();
const { hashPassword } = require("../Auth/passwords");
const {
	users: UsersModel,
	exercise_catalog: CatalogModel,
	food: FoodModel,
	workouts: WorkoutsModel,
	exercises: ExercisesModel,
	sets: SetsModel,
	recipe: RecipeModel,
	diaryEntries: DiaryEntryModel,
} = require("../models/modelInits");
const sequelize = require("../models/db");
const exercisesSeededList = require("./tempExercises");
const nutritionService = require("../Nutrition/service");
const usersService = require("../Users/service");

// ---------------- Users ----------------

const PEOPLE = {
	ethan: {
		userName: "ethan",
		password: "Ethan",
		firstName: "Ethan",
		lastName: "Gordon",
		//body metrics + goals so the Profile page, goal rings and the calculator all have something to show
		profile: {
			sex: "male",
			birth_date: "1998-06-15",
			height_cm: 180,
			weight_kg: 82,
			activity_level: "moderate",
			goal_type: "maintain",
			goals: { calories: 2600, protein: 180, carbs: 280, fat: 80, fiber: 35 },
		},
	},
	alice: { userName: "alice", password: "Alice", firstName: "Alice", lastName: "Anderson", profile: {} },
	bob: { userName: "bob", password: "Bob", firstName: "Bob", lastName: "Baker", profile: {} },
};

// ---------------- Foods ----------------
// nutrient_amount is the amount AT serving_sizes[0]'s weight - CreateFood normalizes to per-100g from there.
// Approximate USDA-style values (one Kirkland label) - fine for exercising the app, not medical-grade.

const macros = (calories, protein, carbs, fat, extra = []) => [
	{ nutrient_name: "calories", unit: "kcal", nutrient_amount: calories },
	{ nutrient_name: "protein", unit: "g", nutrient_amount: protein },
	{ nutrient_name: "carbs", unit: "g", nutrient_amount: carbs },
	{ nutrient_name: "fat", unit: "g", nutrient_amount: fat },
	...extra,
];

const FOODS = [
	// everyday staples (diary + bowl recipes)
	{ name: "Chicken Breast", brand: "Generic", nutrients: macros(231, 43.4, 0, 5.04), serving_sizes: [{ label: "serving", weight_g: 140, default_quantity: 1 }] },
	{ name: "Brown Rice, Cooked", brand: null, nutrients: macros(240, 5.3, 50, 2), serving_sizes: [{ label: "serving", weight_g: 195, default_quantity: 1 }] }, // 1 cup
	{ name: "Broccoli, Steamed", brand: null, nutrients: macros(31, 2.5, 6, 0.3), serving_sizes: [{ label: "serving", weight_g: 91, default_quantity: 1 }] }, // 1 cup
	{ name: "Peanut Butter", brand: "Generic", nutrients: macros(190, 8, 6, 16), serving_sizes: [{ label: "serving", weight_g: 32, default_quantity: 1 }] }, // 2 tbsp
	{ name: "Banana", brand: null, nutrients: macros(105, 1.3, 27, 0.4), serving_sizes: [{ label: "serving", weight_g: 118, default_quantity: 1 }] }, // 1 medium
	{ name: "Rolled Oats", brand: "Generic", nutrients: macros(150, 5, 27, 3), serving_sizes: [{ label: "serving", weight_g: 40, default_quantity: 1 }] }, // 1/2 cup dry
	{ name: "Salmon, Atlantic, Cooked", brand: null, nutrients: macros(280, 39, 0, 12.5), serving_sizes: [{ label: "serving", weight_g: 140, default_quantity: 1 }] },
	{ name: "Eggs, Whole, Large", brand: null, nutrients: macros(72, 6.3, 0.4, 4.8), serving_sizes: [{ label: "egg", weight_g: 50, default_quantity: 1 }] },
	{ name: "Whey Protein Powder", brand: "Generic", nutrients: macros(120, 24, 3, 1.5), serving_sizes: [{ label: "scoop", weight_g: 31, default_quantity: 1 }] },

	// Homemade Tzatziki (https://www.skinnytaste.com/tzatziki/) - also what the recipe-URL import should match
	{
		name: "Kirkland Signature Nonfat Greek Yogurt, Plain",
		brand: "Kirkland Signature",
		nutrients: macros(90, 16, 6, 0, [
			{ nutrient_name: "sugar", unit: "g", nutrient_amount: 6 },
			{ nutrient_name: "sodium", unit: "mg", nutrient_amount: 60 },
		]),
		serving_sizes: [
			{ label: "serving", weight_g: 170, default_quantity: 1 }, // FDA label serving (6oz)
			{ label: "cup", weight_g: 245 },
		],
	},
	{
		name: "Cucumber, Raw",
		brand: null,
		nutrients: macros(22.5, 0.98, 5.45, 0.17), // per ~1 small cucumber
		serving_sizes: [
			{ label: "serving", weight_g: 150, default_quantity: 1 },
			{ label: "cup", weight_g: 120 }, // grated + squeezed dry, per the recipe's note
		],
	},
	{ name: "Garlic, Raw", brand: null, nutrients: macros(4.47, 0.19, 0.99, 0.02), serving_sizes: [{ label: "clove", weight_g: 3, default_quantity: 1 }] },
	{
		name: "Lemon Juice, Raw",
		brand: null,
		nutrients: macros(3.3, 0.05, 1.04, 0.04),
		serving_sizes: [
			{ label: "tbsp", weight_g: 15 },
			{ label: "tsp", weight_g: 5 },
		],
	},
	{ name: "Dill, Fresh", brand: null, nutrients: macros(0.47, 0.04, 0.08, 0.01), serving_sizes: [{ label: "tbsp", weight_g: 1.1 }] },
	{ name: "Chives, Fresh", brand: null, nutrients: macros(0.9, 0.1, 0.13, 0.02), serving_sizes: [{ label: "tbsp", weight_g: 3 }] },
	// "kosher salt and fresh pepper" is one line in the source recipe but two foods
	{
		name: "Kosher Salt",
		brand: null,
		nutrients: macros(0, 0, 0, 0, [{ nutrient_name: "sodium", unit: "mg", nutrient_amount: 2300 }]),
		serving_sizes: [{ label: "tsp", weight_g: 6 }],
	},
	{ name: "Black Pepper, Ground", brand: null, nutrients: macros(5.77, 0.24, 1.47, 0.07), serving_sizes: [{ label: "tsp", weight_g: 2.3 }] },
];

// ---------------- Recipes ----------------
// ingredients: [food name, quantity, unit] - unit must be one of that food's serving labels (or "g")

const RECIPES = {
	ethan: [
		{
			name: "Chicken & Rice Bowl",
			description: "The weekday lunch. Chicken, brown rice and broccoli.",
			servings: 1,
			ingredients: [
				["Chicken Breast", 1, "serving"],
				["Brown Rice, Cooked", 1, "serving"],
				["Broccoli, Steamed", 1, "serving"],
			],
		},
		{
			name: "PB Banana Oats",
			description: "Oats with peanut butter and banana.",
			servings: 1,
			ingredients: [
				["Rolled Oats", 1, "serving"],
				["Banana", 1, "serving"],
				["Peanut Butter", 1, "serving"],
			],
		},
		{
			name: "Homemade Tzatziki",
			description: "From skinnytaste.com/tzatziki. Great with the salmon.",
			servings: 4,
			ingredients: [
				["Kirkland Signature Nonfat Greek Yogurt, Plain", 1, "cup"],
				["Cucumber, Raw", 1, "cup"],
				["Garlic, Raw", 1, "clove"],
				["Lemon Juice, Raw", 1, "tsp"],
				["Dill, Fresh", 1, "tbsp"],
				["Chives, Fresh", 1, "tbsp"],
				["Kosher Salt", 0.25, "tsp"],
				["Black Pepper, Ground", 0.25, "tsp"],
			],
		},
	],
	alice: [
		{ name: "Alice's Chicken Bowl", servings: 2, ingredients: [["Chicken Breast", 1, "serving"]] },
		{ name: "Alice's Salmon Plate", servings: 1, ingredients: [["Salmon, Atlantic, Cooked", 1, "serving"], ["Brown Rice, Cooked", 1, "serving"]] },
		{ name: "Alice's Overnight Oats", servings: 1, ingredients: [["Rolled Oats", 1, "serving"], ["Banana", 0.5, "serving"]] },
	],
	bob: [
		{ name: "Bob's Rice Bowl", servings: 2, ingredients: [["Brown Rice, Cooked", 1, "serving"]] },
		{ name: "Bob's Chicken & Broccoli", servings: 2, ingredients: [["Chicken Breast", 1, "serving"], ["Broccoli, Steamed", 1, "serving"]] },
		{ name: "Bob's Protein Shake", servings: 1, ingredients: [["Whey Protein Powder", 2, "scoop"], ["Banana", 1, "serving"]] },
	],
};

// ---------------- Ethan's training history ----------------
// Push/pull/legs, 3 sessions a week. Each exercise keeps the same order_number within its session type - the
// Progress analytics (biggest changes etc.) only compare a lift against itself at the same position.

const WEEKS_BACK = 10;

const SPLIT = {
	push: [
		{ name: "Barbell Bench Press", reps: [6, 10] },
		{ name: "Overhead Press", reps: [6, 10] },
		{ name: "Tricep Pushdown", reps: [10, 15] },
		{ name: "Plank", reps: [20, 40] },
	],
	pull: [
		{ name: "Barbell Row", reps: [6, 10] },
		{ name: "Barbell Curl", reps: [8, 12] },
		{ name: "Rowing Machine", reps: [20, 40] },
	],
	legs: [
		{ name: "Barbell Squat", reps: [4, 8] },
		{ name: "Hip Thrust", reps: [8, 12] },
		{ name: "Burpee", reps: [12, 20] },
	],
};

// Starting weight and per-week increase. Bodyweight/cardio fillers (Plank, Rowing Machine, Burpee) aren't here,
// so they get weight: null.
const PROGRESSION = {
	"Barbell Bench Press": [135, 2.5],
	"Overhead Press": [65, 1.25],
	"Tricep Pushdown": [50, 2.5],
	"Barbell Row": [115, 2.5],
	"Barbell Curl": [40, 1.25],
	"Barbell Squat": [155, 5],
	"Hip Thrust": [135, 5],
};

const CATALOG_NAMES_NEEDED = [...new Set(Object.values(SPLIT).flatMap((session) => session.map((e) => e.name)))];

// ---------------- Helpers ----------------

// Seeded random numbers, so every reseed produces the same reps/RIR (easier to compare screens across runs)
let randomState = 20261014;
function random() {
	randomState = (randomState + 0x6d2b79f5) | 0;
	let t = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (min, max) => Math.floor(random() * (max - min + 1)) + min;

// Local calendar date N days ago ("2026-10-14"). Not toISOString(): that's UTC and is already tomorrow in the evening.
function daysAgo(n) {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// The app computes workout duration as finished_at - workout_date, and workout_date (DATEONLY) parses as UTC
// midnight - there's no start-time column. So a plausible duration needs finished_at just after UTC midnight.
function finishedAtFor(workoutDate, minutes) {
	return new Date(new Date(`${workoutDate}T00:00:00.000Z`).getTime() + minutes * 60000).toISOString();
}

// ---------------- Seeding steps ----------------

async function ensureUser(person) {
	let user = await UsersModel.findOne({ where: { user_name: person.userName } });
	if (user) {
		console.log(`- "${person.userName}" already exists (id ${user.user_id}), reusing.`);
		return user;
	}
	const hash = await hashPassword(person.password);
	user = await UsersModel.create({ first_name: person.firstName, last_name: person.lastName, user_name: person.userName, password: hash });
	//through the same validation as PATCH /users/me. onboarding_completed so logging in goes straight to the app
	await usersService.updateMe(user.user_id, { ...person.profile, onboarding_completed: true });
	console.log(`- Created "${person.userName}" (id ${user.user_id}).`);
	return user;
}

async function ensureCatalog() {
	await CatalogModel.bulkCreate(exercisesSeededList, { ignoreDuplicates: true });
	const rows = await CatalogModel.findAll({ where: { name: CATALOG_NAMES_NEEDED } });
	const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
	for (const name of CATALOG_NAMES_NEEDED) {
		if (!byName[name]) throw new Error(`Catalog exercise "${name}" missing after seeding - check tempExercises.js`);
	}
	console.log(`- Exercise catalog ready (${exercisesSeededList.length} entries).`);
	return byName;
}

async function ensureFood(spec, submitterUserId) {
	const existing = await FoodModel.findOne({ where: { name: spec.name, brand: spec.brand ?? null, is_deleted: false } });
	if (existing) return existing;
	return nutritionService.CreateFood({ name: spec.name, brand: spec.brand, nutrients: spec.nutrients, serving_sizes: spec.serving_sizes }, submitterUserId);
}

// Saves whole workouts (the same payload shape POST /workouts takes) with 3 bulk INSERTs - workouts, then
// exercises, then sets - in one transaction. Going through CreateWorkout instead costs one INSERT per row,
// ~800 queries for Ethan's history alone. Skips CreateWorkout's checks on purpose: ensureCatalog already
// confirmed every catalog id exists.
async function bulkInsertWorkouts(user, payloads) {
	await sequelize.transaction(async (transaction) => {
		const workoutRows = await WorkoutsModel.bulkCreate(
			payloads.map((p) => ({
				user_id: user.user_id,
				name: p.workout_name,
				workout_date: p.workout_date,
				notes: p.notes,
				finished_at: p.finished_at,
			})),
			{ transaction, returning: true },
		);

		//Postgres hands the new rows back in insert order, so row i belongs to input i - that's how each
		//exercise finds its new workout_id, and each set its new exercise_id
		const exercises = payloads.flatMap((p, i) => p.exercises.map((e) => ({ ...e, workout_id: workoutRows[i].workout_id })));
		const exerciseRows = await ExercisesModel.bulkCreate(
			exercises.map(({ workout_id, catalog_id, order_number, notes }) => ({ workout_id, catalog_id, order_number, notes })),
			{ transaction, returning: true },
		);

		const sets = exercises.flatMap((e, i) =>
			e.sets.map(({ set_type, weight, reps, reps_in_reserve, order_number, notes }) => ({
				exercise_id: exerciseRows[i].exercise_id,
				set_type,
				weight,
				reps,
				reps_in_reserve: reps_in_reserve ?? null,
				order_number,
				notes,
			})),
		);
		await SetsModel.bulkCreate(sets, { transaction });
	});
}

// Diary rows go in with one bulk INSERT too, so check here (without queries) what addDiaryEntry would have:
// food entries need one of that food's serving labels (or "g"), recipe entries are always "serving".
function assertDiaryUnits(entries, foodsByName) {
	const foodSpecs = Object.fromEntries(FOODS.map((f) => [f.name, f]));
	const nameById = Object.fromEntries(Object.entries(foodsByName).map(([name, row]) => [row.id, name]));
	for (const e of entries) {
		if (e.recipe_id) {
			if (e.unit !== "serving") throw new Error(`Recipe diary entries must use "serving", got "${e.unit}"`);
			continue;
		}
		const spec = foodSpecs[nameById[e.food_id]];
		if (e.unit !== "g" && !spec?.serving_sizes.some((s) => s.label === e.unit)) {
			throw new Error(`"${nameById[e.food_id]}" has no "${e.unit}" serving size`);
		}
	}
}

//true if this user already has rows in the model - each section is skipped then, so reruns don't duplicate
async function alreadyHas(model, user, label) {
	const count = await model.count({ where: { user_id: user.user_id } });
	if (count > 0) console.log(`- ${user.user_name} already has ${count} ${label}, skipping.`);
	return count > 0;
}

async function seedEthanWorkouts(user, catalogByName) {
	if (await alreadyHas(WorkoutsModel, user, "workouts")) return;

	const sessionTypes = Object.keys(SPLIT);
	const payloads = [];

	for (let week = WEEKS_BACK - 1; week >= 0; week--) {
		const weeksIn = WEEKS_BACK - 1 - week; //0 in the oldest week, climbing toward now: progressive overload

		for (let i = 0; i < sessionTypes.length; i++) {
			const sessionType = sessionTypes[i];
			const workoutDate = daysAgo(week * 7 + 6 - i * 2); //Mon/Wed/Fri-style, the newest session 2 days ago

			const exercises = SPLIT[sessionType].map((slot, index) => {
				const [base, perWeek] = PROGRESSION[slot.name] ?? [0, 0];
				const weight = base ? base + perWeek * weeksIn : null;
				const sets = [];
				//1-2 lighter warmups (every analytics query filters these out), then 3-4 working sets
				const warmups = randInt(1, 2);
				const workingSets = randInt(3, 4);
				for (let w = 0; w < warmups; w++) {
					sets.push({ set_type: "warmup", weight: weight ? Math.round(weight * 0.5) : null, reps: randInt(8, 12), reps_in_reserve: null });
				}
				for (let w = 0; w < workingSets; w++) {
					//about half the working sets have RIR, covering both branches of the RIR-adjusted e1RM
					sets.push({ set_type: "working", weight, reps: randInt(slot.reps[0], slot.reps[1]), reps_in_reserve: random() < 0.5 ? randInt(1, 4) : null });
				}
				return {
					catalog_id: catalogByName[slot.name].catalog_id,
					order_number: index + 1,
					notes: "",
					sets: sets.map((s, n) => ({ ...s, order_number: n + 1, notes: "" })),
				};
			});

			payloads.push({
				workout_name: `${sessionType.charAt(0).toUpperCase()}${sessionType.slice(1)} day`,
				workout_date: workoutDate,
				notes: "",
				finished_at: finishedAtFor(workoutDate, randInt(45, 75)),
				exercises,
			});
		}
	}

	await bulkInsertWorkouts(user, payloads);
	const setCount = payloads.reduce((n, p) => n + p.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
	console.log(`- Created ${payloads.length} workouts (${setCount} sets) over ${WEEKS_BACK} weeks for ${user.user_name}.`);
}

// Alice and Bob: three short full-body sessions over the last few days
async function seedSampleWorkouts(user, catalogByName) {
	if (await alreadyHas(WorkoutsModel, user, "workouts")) return;

	const session = (name, date) => ({
		workout_name: name,
		workout_date: date,
		notes: "",
		finished_at: finishedAtFor(date, 60),
		exercises: [
			{
				catalog_id: catalogByName["Barbell Bench Press"].catalog_id,
				order_number: 1,
				notes: "",
				sets: [
					{ set_type: "warmup", order_number: 1, reps: 10, weight: 95, notes: "" },
					{ set_type: "working", order_number: 2, reps: 8, weight: 155, reps_in_reserve: 2, notes: "" },
					{ set_type: "working", order_number: 3, reps: 8, weight: 155, reps_in_reserve: 1, notes: "" },
				],
			},
			{
				catalog_id: catalogByName["Barbell Squat"].catalog_id,
				order_number: 2,
				notes: "",
				sets: [
					{ set_type: "warmup", order_number: 1, reps: 10, weight: 115, notes: "" },
					{ set_type: "working", order_number: 2, reps: 6, weight: 185, reps_in_reserve: 2, notes: "" },
					{ set_type: "working", order_number: 3, reps: 6, weight: 185, reps_in_reserve: 1, notes: "" },
				],
			},
		],
	});

	await bulkInsertWorkouts(user, [
		session("Full body A", daysAgo(3)),
		session("Full body B", daysAgo(1)),
		session("Full body C", daysAgo(0)),
	]);
	console.log(`- Created 3 workouts for ${user.user_name}.`);
}

async function seedRecipes(user, specs, foodsByName) {
	if (await alreadyHas(RecipeModel, user, "recipes")) {
		const existing = await RecipeModel.findAll({ where: { user_id: user.user_id } });
		return Object.fromEntries(existing.map((r) => [r.name, r]));
	}

	const byName = {};
	for (const spec of specs) {
		byName[spec.name] = await nutritionService.createRecipe(
			{
				name: spec.name,
				description: spec.description ?? null,
				servings: spec.servings,
				ingredients: spec.ingredients.map(([food, quantity, unit]) => ({ food_id: foodsByName[food].id, quantity, unit })),
			},
			user.user_id,
		);
	}
	console.log(`- Created ${specs.length} recipes for ${user.user_name}.`);
	return byName;
}

// Two weeks of Ethan eating roughly to his goals: recipes for breakfast and lunch, foods for dinner and snacks.
async function seedEthanDiary(user, foodsByName, recipesByName) {
	if (await alreadyHas(DiaryEntryModel, user, "diary entries")) return;

	const food = (name, meal_type, quantity, unit) => ({ food_id: foodsByName[name].id, meal_type, quantity, unit });
	const recipe = (name, meal_type, quantity = 1) => ({ recipe_id: recipesByName[name].recipe_id, meal_type, quantity, unit: "serving" });

	const rows = [];
	for (let day = 13; day >= 0; day--) {
		const logged_at = daysAgo(day);
		const entries = [
			recipe("PB Banana Oats", "breakfast"),
			recipe("Chicken & Rice Bowl", "lunch"),
			//alternate dinners so day-to-day totals differ
			...(day % 2 === 0
				? [food("Salmon, Atlantic, Cooked", "dinner", 1, "serving"), food("Brown Rice, Cooked", "dinner", 1, "serving"), recipe("Homemade Tzatziki", "dinner", 0.5)]
				: [food("Chicken Breast", "dinner", 1.5, "serving"), food("Broccoli, Steamed", "dinner", 2, "serving")]),
			food("Whey Protein Powder", "snack", 1, "scoop"),
			...(day % 3 === 0 ? [food("Eggs, Whole, Large", "snack", 2, "egg")] : []),
		];
		for (const entry of entries) rows.push({ ...entry, logged_at, user_id: user.user_id });
	}

	assertDiaryUnits(rows, foodsByName);
	await DiaryEntryModel.bulkCreate(rows);
	console.log(`- Logged ${rows.length} diary entries over 14 days for ${user.user_name}.`);
}

// Today + yesterday: oats for breakfast and a banana snack
async function seedSimpleDiary(user, foodsByName) {
	if (await alreadyHas(DiaryEntryModel, user, "diary entries")) return;

	const rows = [daysAgo(1), daysAgo(0)].flatMap((logged_at) => [
		{ user_id: user.user_id, food_id: foodsByName["Rolled Oats"].id, meal_type: "breakfast", logged_at, quantity: 1, unit: "serving" },
		{ user_id: user.user_id, food_id: foodsByName["Banana"].id, meal_type: "snack", logged_at, quantity: 1, unit: "serving" },
	]);
	assertDiaryUnits(rows, foodsByName);
	await DiaryEntryModel.bulkCreate(rows);
	console.log(`- Logged ${rows.length} diary entries for ${user.user_name}.`);
}

// --fresh: delete the three demo users (and everything they own) so the seed starts clean.
// Shared foods survive with submitted_by cleared, and get reused below.
async function deleteDemoUsers() {
	for (const person of Object.values(PEOPLE)) {
		const user = await UsersModel.findOne({ where: { user_name: person.userName } });
		if (!user) continue;
		await usersService.deleteMe(user.user_id);
		console.log(`- Deleted "${person.userName}" and their data.`);
	}
}

// Exported so models/modelInits.js can run it on boot (SEED_DEMO_DATA flag). Throws on failure.
// db.js logs every SQL statement outside tests; that's a couple hundred lines of noise here, so it's
// switched off for the seed and put back after (on boot, the server keeps its normal logging).
async function seedDemoData({ fresh = false } = {}) {
	const previousLogging = sequelize.options.logging;
	sequelize.options.logging = false;
	try {
		await runSeed(fresh);
	} finally {
		sequelize.options.logging = previousLogging;
	}
}

async function runSeed(fresh) {
	if (fresh) {
		console.log("Removing existing demo users (--fresh)...");
		await deleteDemoUsers();
	}

	console.log("Users...");
	const usersByKey = {};
	for (const [key, person] of Object.entries(PEOPLE)) usersByKey[key] = await ensureUser(person);

	console.log("Exercise catalog...");
	const catalogByName = await ensureCatalog();

	console.log("Foods...");
	const foodsByName = {};
	for (const spec of FOODS) foodsByName[spec.name] = await ensureFood(spec, usersByKey.ethan.user_id);
	console.log(`- ${FOODS.length} foods ready.`);

	console.log("Workouts...");
	await seedEthanWorkouts(usersByKey.ethan, catalogByName);
	await seedSampleWorkouts(usersByKey.alice, catalogByName);
	await seedSampleWorkouts(usersByKey.bob, catalogByName);

	console.log("Recipes...");
	const ethanRecipes = await seedRecipes(usersByKey.ethan, RECIPES.ethan, foodsByName);
	await seedRecipes(usersByKey.alice, RECIPES.alice, foodsByName);
	await seedRecipes(usersByKey.bob, RECIPES.bob, foodsByName);

	console.log("Diary...");
	await seedEthanDiary(usersByKey.ethan, foodsByName, ethanRecipes);
	await seedSimpleDiary(usersByKey.alice, foodsByName);
	await seedSimpleDiary(usersByKey.bob, foodsByName);

	console.log(`\nDemo data ready. Log in as ${Object.values(PEOPLE).map((p) => `${p.userName} / ${p.password}`).join(", ")}.`);
}

// Run directly: seed, then close the connection so the process exits. Not when required by modelInits -
// closing there would kill the app's shared connection.
if (require.main === module) {
	seedDemoData({ fresh: process.argv.includes("--fresh") })
		.catch((err) => {
			console.error("Seed failed:", err);
			process.exitCode = 1;
		})
		.finally(() => sequelize.close());
}

module.exports = { seedDemoData };
