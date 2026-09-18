// Seeds a broad "one of everything" social demo dataset: the full exercise catalog,
// six users with a variety of friendship states (accepted / pending incoming / pending
// outgoing / no relationship at all), plus foods, recipes, workouts, and diary entries
// spread across all the visibility levels — so the Friends tab, Explore feed, friend-diary
// screen, and visibility toggles all have real data to look at without manually clicking
// through the app first.
//
// Safe to re-run: users/foods are found-or-created by name, the exercise catalog uses
// ignoreDuplicates, friendships are found-or-created per pair, and workouts/recipes/diary
// entries are skipped entirely per-user if that user already has any (delete their rows
// first if you want to reseed that part from scratch).
//
// Run with:  cd backend && node SeedDatabaseScripts/seedSocialDemo.js
//
// Then log in as any of (all share the same password):
//   userName: "alice_demo" | "bob_demo" | "carla_demo" | "derek_demo" | "erin_demo" | "frank_demo"
//   password: "DemoPass123!"
//
// Friend graph:
//   Alice <-> Bob     accepted
//   Alice <-> Carla   accepted
//   Bob   <-> Carla   accepted        (Alice/Bob/Carla form a friend triangle)
//   Derek  -> Alice   pending, requested by Derek   (Alice has an INCOMING request)
//   Alice  -> Erin    pending, requested by Alice   (Alice has an OUTGOING request)
//   Frank             no friends, no pending requests at all (tests the empty state)
//
// Content: Alice and Bob each get a private + friends + public workout and recipe, and a
// couple of diary entries (one friends-visible, one private) logged today/yesterday - so
// logging in as Carla (friend) vs Derek/Erin/Frank (not yet friends) shows the visibility
// rules actually working, not just present in the schema.
//
// NOTE: backend/IntegrationTests/*.test.js wipe the whole DB (sequelize.sync({force:true})
// in beforeAll). Run `npm test` BEFORE this script if you want to keep this data around.

require("dotenv").config();
const bcrypt = require("bcrypt");
const {
	users: UsersModel,
	exercise_catalog: CatalogModel,
	friendships: FriendshipsModel,
	food: FoodModel,
	workouts: WorkoutsModel,
	recipe: RecipeModel,
	diaryEntries: DiaryEntryModel,
} = require("../models/modelInits");
const sequelize = require("../models/db");
const exercisesSeededList = require("./tempExercises");
const nutritionService = require("../Nutrition/service");
const workoutService = require("../Workouts/service");

const DEMO_PASSWORD = "DemoPass123!";

const DEMO_USERS = [
	{ key: "alice", userName: "alice_demo", firstName: "Alice", lastName: "Anderson" },
	{ key: "bob", userName: "bob_demo", firstName: "Bob", lastName: "Baker" },
	{ key: "carla", userName: "carla_demo", firstName: "Carla", lastName: "Cruz" },
	{ key: "derek", userName: "derek_demo", firstName: "Derek", lastName: "Diaz" },
	{ key: "erin", userName: "erin_demo", firstName: "Erin", lastName: "Ellis" },
	{ key: "frank", userName: "frank_demo", firstName: "Frank", lastName: "Foster" },
];

// [requester, addressee, status] - status "accepted" or "pending". Frank is deliberately
// absent from every link (see header comment).
const FRIEND_LINKS = [
	["alice", "bob", "accepted"],
	["alice", "carla", "accepted"],
	["bob", "carla", "accepted"],
	["derek", "alice", "pending"],
	["alice", "erin", "pending"],
];

// nutrient_amount is the amount AT serving_sizes[0]'s weight - CreateFood normalizes to
// per-100g from there (same convention as seedTzatzikiFoods.js). Approximate USDA-style
// values - fine for exercising the app end to end, not medical-grade.
const FOODS = [
	{
		name: "Chicken Breast",
		brand: "Generic",
		nutrients: [
			{ nutrient_name: "calories", unit: "kcal", nutrient_amount: 231 },
			{ nutrient_name: "protein", unit: "g", nutrient_amount: 43.4 },
			{ nutrient_name: "carbs", unit: "g", nutrient_amount: 0 },
			{ nutrient_name: "fat", unit: "g", nutrient_amount: 5.04 },
		],
		serving_sizes: [{ label: "serving", weight_g: 140, default_quantity: 1 }],
	},
	{
		name: "Brown Rice, Cooked",
		brand: null,
		nutrients: [
			{ nutrient_name: "calories", unit: "kcal", nutrient_amount: 240 },
			{ nutrient_name: "protein", unit: "g", nutrient_amount: 5.3 },
			{ nutrient_name: "carbs", unit: "g", nutrient_amount: 50 },
			{ nutrient_name: "fat", unit: "g", nutrient_amount: 2 },
		],
		serving_sizes: [{ label: "serving", weight_g: 195, default_quantity: 1 }], // 1 cup
	},
	{
		name: "Broccoli, Steamed",
		brand: null,
		nutrients: [
			{ nutrient_name: "calories", unit: "kcal", nutrient_amount: 31 },
			{ nutrient_name: "protein", unit: "g", nutrient_amount: 2.5 },
			{ nutrient_name: "carbs", unit: "g", nutrient_amount: 6 },
			{ nutrient_name: "fat", unit: "g", nutrient_amount: 0.3 },
		],
		serving_sizes: [{ label: "serving", weight_g: 91, default_quantity: 1 }], // 1 cup
	},
	{
		name: "Peanut Butter",
		brand: "Generic",
		nutrients: [
			{ nutrient_name: "calories", unit: "kcal", nutrient_amount: 190 },
			{ nutrient_name: "protein", unit: "g", nutrient_amount: 8 },
			{ nutrient_name: "carbs", unit: "g", nutrient_amount: 6 },
			{ nutrient_name: "fat", unit: "g", nutrient_amount: 16 },
		],
		serving_sizes: [{ label: "serving", weight_g: 32, default_quantity: 1 }], // 2 tbsp
	},
	{
		name: "Banana",
		brand: null,
		nutrients: [
			{ nutrient_name: "calories", unit: "kcal", nutrient_amount: 105 },
			{ nutrient_name: "protein", unit: "g", nutrient_amount: 1.3 },
			{ nutrient_name: "carbs", unit: "g", nutrient_amount: 27 },
			{ nutrient_name: "fat", unit: "g", nutrient_amount: 0.4 },
		],
		serving_sizes: [{ label: "serving", weight_g: 118, default_quantity: 1 }], // 1 medium
	},
	{
		name: "Rolled Oats",
		brand: "Generic",
		nutrients: [
			{ nutrient_name: "calories", unit: "kcal", nutrient_amount: 150 },
			{ nutrient_name: "protein", unit: "g", nutrient_amount: 5 },
			{ nutrient_name: "carbs", unit: "g", nutrient_amount: 27 },
			{ nutrient_name: "fat", unit: "g", nutrient_amount: 3 },
		],
		serving_sizes: [{ label: "serving", weight_g: 40, default_quantity: 1 }], // 1/2 cup dry
	},
];

const CATALOG_NAMES_NEEDED = ["Barbell Bench Press", "Barbell Squat", "Overhead Press", "Barbell Row"];

function toDateOnly(date) {
	return date.toISOString().slice(0, 10);
}
const TODAY = toDateOnly(new Date());
const YESTERDAY = toDateOnly(new Date(Date.now() - 86400000));

async function ensureUser(spec) {
	let user = await UsersModel.findOne({ where: { user_name: spec.userName } });
	if (user) {
		console.log(`User "${spec.userName}" already exists (id ${user.user_id}), reusing.`);
		return user;
	}
	const hash = await bcrypt.hash(DEMO_PASSWORD + process.env.PEPPER, await bcrypt.genSalt(10));
	user = await UsersModel.create({ first_name: spec.firstName, last_name: spec.lastName, user_name: spec.userName, password: hash });
	console.log(`Created user "${spec.userName}" (id ${user.user_id}).`);
	return user;
}

async function ensureCatalog() {
	await CatalogModel.bulkCreate(exercisesSeededList, { ignoreDuplicates: true });
	console.log(`Exercise catalog ready (${exercisesSeededList.length} entries, duplicates skipped).`);

	const rows = await CatalogModel.findAll({ where: { name: CATALOG_NAMES_NEEDED } });
	const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
	for (const name of CATALOG_NAMES_NEEDED) {
		if (!byName[name]) throw new Error(`Expected catalog exercise "${name}" not found after seeding - check tempExercises.js`);
	}
	return byName;
}

async function ensureFriendship(usersByKey, requesterKey, addresseeKey, status) {
	const requester = usersByKey[requesterKey];
	const addressee = usersByKey[addresseeKey];
	const [user_id_a, user_id_b] = requester.user_id < addressee.user_id ? [requester.user_id, addressee.user_id] : [addressee.user_id, requester.user_id];

	const [row, created] = await FriendshipsModel.findOrCreate({
		where: { user_id_a, user_id_b },
		defaults: { user_id_a, user_id_b, requested_by: requester.user_id, status },
	});

	console.log(created ? `- ${requesterKey} -> ${addresseeKey}: created (${status}).` : `- ${requesterKey} <-> ${addresseeKey}: already exists (${row.status}), reusing.`);
	return row;
}

async function ensureFood(spec, submitterUserId) {
	const existing = await FoodModel.findOne({ where: { name: spec.name, brand: spec.brand ?? null, is_deleted: false } });
	if (existing) {
		console.log(`- "${spec.name}" already exists (id ${existing.id}) - reusing.`);
		return existing;
	}
	const created = await nutritionService.CreateFood({ name: spec.name, brand: spec.brand, nutrients: spec.nutrients, serving_sizes: spec.serving_sizes }, submitterUserId);
	console.log(`- Created "${spec.name}" (id ${created.id}).`);
	return created;
}

function buildWorkoutData(name, date, visibility, catalogByName) {
	return {
		workout_name: name,
		workout_date: date,
		visibility,
		finished_at: `${date}T15:30:00.000Z`,
		exercises: [
			{
				catalog_id: catalogByName["Barbell Bench Press"].catalog_id,
				order_number: 1,
				sets: [
					{ set_type: "warmup", order_number: 1, reps: 10, weight: 95 },
					{ set_type: "working", order_number: 2, reps: 8, weight: 155 },
					{ set_type: "working", order_number: 3, reps: 8, weight: 155 },
				],
			},
			{
				catalog_id: catalogByName["Barbell Squat"].catalog_id,
				order_number: 2,
				sets: [
					{ set_type: "warmup", order_number: 1, reps: 10, weight: 115 },
					{ set_type: "working", order_number: 2, reps: 6, weight: 185 },
					{ set_type: "working", order_number: 3, reps: 6, weight: 185 },
				],
			},
		],
	};
}

async function seedWorkoutsForUser(user, catalogByName) {
	const existingCount = await WorkoutsModel.count({ where: { user_id: user.user_id } });
	if (existingCount > 0) {
		console.log(`- ${user.user_name} already has ${existingCount} workout(s) - skipping.`);
		return;
	}

	await workoutService.CreateWorkout(buildWorkoutData(`${user.first_name}'s Private Session`, YESTERDAY, "private", catalogByName), user.user_id);
	await workoutService.CreateWorkout(buildWorkoutData(`${user.first_name}'s Friends Session`, YESTERDAY, "friends", catalogByName), user.user_id);
	await workoutService.CreateWorkout(buildWorkoutData(`${user.first_name}'s Public Session`, TODAY, "public", catalogByName), user.user_id);
	console.log(`- Created 3 workouts (private/friends/public) for ${user.user_name}.`);
}

async function seedRecipesForUser(user, foodsByName) {
	const existingCount = await RecipeModel.count({ where: { user_id: user.user_id } });
	if (existingCount > 0) {
		console.log(`- ${user.user_name} already has ${existingCount} recipe(s) - skipping.`);
		return {};
	}

	const specs = [
		{ name: `${user.first_name}'s Private Bowl`, visibility: "private", food: "Chicken Breast" },
		{ name: `${user.first_name}'s Friends Bowl`, visibility: "friends", food: "Brown Rice, Cooked" },
		{ name: `${user.first_name}'s Public Bowl`, visibility: "public", food: "Broccoli, Steamed" },
	];

	const created = {};
	for (const spec of specs) {
		const food = foodsByName[spec.food];
		const recipe = await nutritionService.createRecipe(
			{
				name: spec.name,
				description: `Demo recipe built around ${spec.food.split(",")[0]}.`,
				servings: 2,
				visibility: spec.visibility,
				ingredients: [{ food_id: food.id, quantity: 1, unit: "serving" }],
			},
			user.user_id,
		);
		created[spec.visibility] = recipe;
	}
	console.log(`- Created 3 recipes (private/friends/public) for ${user.user_name}.`);
	return created;
}

async function seedDiaryForUser(user, foodsByName) {
	const existingCount = await DiaryEntryModel.count({ where: { user_id: user.user_id } });
	if (existingCount > 0) {
		console.log(`- ${user.user_name} already has ${existingCount} diary entr${existingCount === 1 ? "y" : "ies"} - skipping.`);
		return;
	}

	const banana = foodsByName["Banana"];
	const oats = foodsByName["Rolled Oats"];

	await nutritionService.addDiaryEntry({ food_id: oats.id, meal_type: "breakfast", logged_at: TODAY, quantity: 1, unit: "serving", visibility: "friends" }, user.user_id);
	await nutritionService.addDiaryEntry({ food_id: banana.id, meal_type: "snack", logged_at: TODAY, quantity: 1, unit: "serving", visibility: "private" }, user.user_id);
	await nutritionService.addDiaryEntry({ food_id: oats.id, meal_type: "breakfast", logged_at: YESTERDAY, quantity: 1, unit: "serving", visibility: "friends" }, user.user_id);
	console.log(`- Logged 3 diary entries (2 friends-visible, 1 private) for ${user.user_name}.`);
}

async function main() {
	try {
		console.log("Seeding users...");
		const usersByKey = {};
		for (const spec of DEMO_USERS) usersByKey[spec.key] = await ensureUser(spec);

		console.log("\nSeeding exercise catalog...");
		const catalogByName = await ensureCatalog();

		console.log("\nSeeding friendships...");
		for (const [requesterKey, addresseeKey, status] of FRIEND_LINKS) {
			await ensureFriendship(usersByKey, requesterKey, addresseeKey, status);
		}

		console.log("\nSeeding foods...");
		const foodsByName = {};
		for (const spec of FOODS) foodsByName[spec.name] = await ensureFood(spec, usersByKey.alice.user_id);

		console.log("\nSeeding workouts (Alice & Bob)...");
		await seedWorkoutsForUser(usersByKey.alice, catalogByName);
		await seedWorkoutsForUser(usersByKey.bob, catalogByName);

		console.log("\nSeeding recipes (Alice & Bob)...");
		await seedRecipesForUser(usersByKey.alice, foodsByName);
		await seedRecipesForUser(usersByKey.bob, foodsByName);

		console.log("\nSeeding diary entries (Alice & Bob)...");
		await seedDiaryForUser(usersByKey.alice, foodsByName);
		await seedDiaryForUser(usersByKey.bob, foodsByName);

		console.log("\nSeed complete. Log in as e.g. alice_demo / DemoPass123! (see file header for the full user list and friend graph).");
	} catch (err) {
		console.error("Seed failed:", err);
		process.exitCode = 1;
	} finally {
		await sequelize.close();
	}
}

main();
