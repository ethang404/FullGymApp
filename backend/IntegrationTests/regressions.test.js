// Bugs found in the 2026-11 backend review - each test fails on the old code
const request = require("supertest");
const sequelize = require("../models/db");
const {
	exercise_catalog: ExerciseCatalogModel,
	sets: SetsModel,
	exercises: ExercisesModel,
	food: FoodModel,
	recipeIngredient: RecipeIngredientModel,
	diaryEntries: DiaryEntriesModel,
} = require("../models/modelInits");
const { app, registerUser, createGuest, bearer, createRecipe, makeFriends } = require("./SocialHelpers");

// sync({force:true}) rebuilds every table - extended timeout, same as the other suites
beforeAll(async () => {
	await sequelize.sync({ force: true });
}, 30000);

afterAll(async () => {
	await sequelize.close();
});

describe("PUT /workouts/:id can't touch another user's exercises/sets", () => {
	test("foreign exercise_id / set_id in my payload leave the other user's rows alone", async () => {
		const victim = await registerUser("victim");
		const attacker = await registerUser("attacker");
		const catalog = await ExerciseCatalogModel.create({ name: "Regression Press", muscle_group: "chest" });

		const workout_body = (name) => ({
			workout_name: name,
			workout_date: "2026-10-01",
			notes: "",
			finished_at: null,
			exercises: [{ catalog_id: catalog.catalog_id, notes: "", order_number: 1, sets: [{ order_number: 1, set_type: "working", notes: "", reps: 5, weight: 100, reps_in_reserve: 2 }] }],
		});

		await request(app).post("/workouts").set(bearer(victim)).send(workout_body("Victim day"));
		await request(app).post("/workouts").set(bearer(attacker)).send(workout_body("Attacker day"));

		//victim's workout was created first, so it holds the lowest set id
		const victim_set = await SetsModel.findOne({ order: [["set_id", "ASC"]] });
		const victim_exercise = await ExercisesModel.findByPk(victim_set.exercise_id);
		const attacker_workout_id = (await request(app).get("/workouts").set(bearer(attacker))).body.workouts[0].id;

		await request(app)
			.put(`/workouts/${attacker_workout_id}`)
			.set(bearer(attacker))
			.send({
				...workout_body("Attacker day"),
				exercises: [
					{
						exercise_id: victim_exercise.exercise_id,
						catalog_id: catalog.catalog_id,
						notes: "pwned",
						order_number: 1,
						sets: [{ set_id: victim_set.set_id, order_number: 1, set_type: "working", notes: "", reps: 1, weight: 999, reps_in_reserve: 0 }],
					},
				],
			});

		const after_set = await SetsModel.findByPk(victim_set.set_id);
		const after_exercise = await ExercisesModel.findByPk(victim_exercise.exercise_id);
		expect(Number(after_set.weight)).toBe(100);
		expect(after_set.reps).toBe(5);
		expect(after_exercise.notes).toBe("");
		expect(after_exercise.workout_id).toBe(victim_exercise.workout_id);
	});
});

describe("non-numeric route ids are a 400, not a postgres 500", () => {
	test.each([
		["get", "/posts/abc"],
		["get", "/posts/1.5/comments"],
		["delete", "/posts/1/comments/xyz"],
		["get", "/groups/abc"],
		["delete", "/groups/1/members/-3"],
		["get", "/friends/abc?start_date=2026-10-01"],
		["post", "/friends/requests/abc/accept"],
		["post", "/users/abc/block"],
		["get", "/workouts/abc"],
		["get", "/nutrition/recipes/abc"],
		["get", "/posts/99999999999"],
	])("%s %s", async (method, url) => {
		const user = await registerUser("badid");
		const resp = await request(app)[method](url).set(bearer(user));
		expect(resp.status).toBe(400);
	});

	test("auth still comes first on the social routers", async () => {
		const resp = await request(app).get("/groups/abc");
		expect(resp.status).toBe(401);
	});
});

describe("PUT /nutrition/diary/:id on a recipe entry", () => {
	test("editing a recipe diary entry with ingredients returns 200, not a 500", async () => {
		const user = await registerUser("eater");
		const food = await FoodModel.create({ name: "Rice", source: "user_submitted" });
		const recipe = await createRecipe(user);
		await RecipeIngredientModel.create({ recipe_id: recipe.recipe_id, food_id: food.id, quantity: 100, unit: "g", calories: 130, protein: 3, carbs: 28, fat: 0 });
		const entry = await DiaryEntriesModel.create({ user_id: user.id, recipe_id: recipe.recipe_id, meal_type: "dinner", logged_at: "2026-10-01", quantity: 1, unit: "serving" });

		const resp = await request(app).put(`/nutrition/diary/${entry.id}`).set(bearer(user)).send({ quantity: 2 });
		expect(resp.status).toBe(200);
	});
});

describe("status codes", () => {
	test("a food that doesn't exist -> 404, not 400", async () => {
		const user = await registerUser("foodie");
		expect((await request(app).get("/nutrition/foods/999999").set(bearer(user))).status).toBe(404);

		const serving = await request(app)
			.post("/nutrition/foods/999999/serving-sizes")
			.set(bearer(user))
			.send({ label: "cup", weight_g: 240 });
		expect(serving.status).toBe(404);
	});

	test("registering a taken username -> 409, not 500", async () => {
		const taken = await registerUser("taken");
		const resp = await request(app)
			.post("/auth/register")
			.send({ firstName: "Dup", lastName: "User", userName: taken.userName, password: "Whatever123!" });
		expect(resp.status).toBe(409);
		expect(resp.body.message).toBe("Username is already taken");
	});

	test("upgrading a guest to a taken username -> 409 too", async () => {
		const taken = await registerUser("taken");
		const guest = await createGuest();
		const resp = await request(app)
			.post("/auth/upgrade-guest")
			.set(bearer(guest))
			.send({ firstName: "Dup", lastName: "User", userName: taken.userName, password: "Whatever123!" });
		expect(resp.status).toBe(409);
	});
});

describe("GET /friends/:friend_id validates dates up front", () => {
	test("bad dates are a 400 even when the friend shares workouts (used to reach postgres as a 500)", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		await makeFriends(alice, bob); //default sharing: workouts on, diary off

		const get = (query) => request(app).get(`/friends/${bob.id}?${query}`).set(bearer(alice));

		expect((await get("start_date=banana")).status).toBe(400);
		expect((await get("start_date=2026-10-01&end_date=2026-13-45")).status).toBe(400);
		expect((await get("start_date=2026-10-10&end_date=2026-10-01")).status).toBe(400);
		expect((await get("start_date=2026-10-01&end_date=2026-10-10")).status).toBe(200);
	});
});

describe("recipe soft delete", () => {
	let chef;
	let fan;
	let recipe;
	let entry;
	let post;

	//chef has a recipe with an ingredient, logged it once, and shared it publicly - then deletes it
	beforeAll(async () => {
		chef = await registerUser("chef");
		fan = await registerUser("fan");
		const food = await FoodModel.create({ name: "Lentils", source: "user_submitted" });
		recipe = await createRecipe(chef, "Lentil soup");
		await RecipeIngredientModel.create({ recipe_id: recipe.recipe_id, food_id: food.id, quantity: 100, unit: "g", calories: 116, protein: 9, carbs: 20, fat: 0 });
		entry = await DiaryEntriesModel.create({ user_id: chef.id, recipe_id: recipe.recipe_id, meal_type: "lunch", logged_at: "2026-10-01", quantity: 1, unit: "serving" });
		post = (await request(app).post("/posts").set(bearer(chef)).send({ recipe_id: recipe.recipe_id, caption: "Soup" })).body.post;

		const resp = await request(app).delete(`/nutrition/recipes/${recipe.recipe_id}`).set(bearer(chef));
		expect(resp.status).toBe(200);
	});

	test("gone from my recipe list, the detail page, editing and logging", async () => {
		const list = await request(app).get("/nutrition/recipes").set(bearer(chef));
		expect(list.body.recipes.map((r) => r.id ?? r.recipe_id)).not.toContain(recipe.recipe_id);

		expect((await request(app).get(`/nutrition/recipes/${recipe.recipe_id}`).set(bearer(chef))).status).toBe(404);

		const edit = await request(app)
			.put(`/nutrition/recipes/${recipe.recipe_id}`)
			.set(bearer(chef))
			.send({ name: "Renamed", ingredients: [{ food_id: 1, quantity: 1, unit: "g" }] });
		expect(edit.status).toBe(404);

		const log = await request(app)
			.post("/nutrition/diary")
			.set(bearer(chef))
			.send({ recipe_id: recipe.recipe_id, meal_type: "dinner", logged_at: "2026-10-02", quantity: 1, unit: "serving" });
		expect(log.status).toBe(404);
	});

	test("past diary entries still show it, with macros, marked as deleted", async () => {
		const resp = await request(app).get("/nutrition/diary?start_date=2026-10-01").set(bearer(chef));
		expect(resp.status).toBe(200);
		const logged = resp.body.diary_entries.find((e) => e.id === entry.id);
		expect(logged.recipe.name).toBe("Lentil soup");
		expect(logged.recipe.is_deleted).toBe(true);
		expect(logged.nutrients).toBeDefined();
	});

	test("the post stays but shows the recipe as unavailable", async () => {
		const resp = await request(app).get(`/posts/${post.id}`).set(bearer(fan));
		expect(resp.status).toBe(200);
		expect(resp.body.post.caption).toBe("Soup");
		expect(resp.body.post.attachment_type).toBe("recipe");
		expect(resp.body.post.attachment).toBeNull();
		expect(resp.body.post.attachment_status).toBe("unavailable");
	});

	test("can't save it from the post, and can't share it again", async () => {
		const save = await request(app).post(`/posts/${post.id}/save-recipe`).set(bearer(fan));
		expect(save.status).toBe(404);
		expect(save.body.message).toBe("This recipe is no longer available");

		const share = await request(app).post("/posts").set(bearer(chef)).send({ recipe_id: recipe.recipe_id });
		expect(share.status).toBe(404);
	});

	test("a diary row with neither a food nor a recipe (old hard delete leftovers) is skipped, not sent as null", async () => {
		await DiaryEntriesModel.create({ user_id: chef.id, meal_type: "snack", logged_at: "2026-10-01", quantity: 1, unit: "serving" });
		const resp = await request(app).get("/nutrition/diary?start_date=2026-10-01").set(bearer(chef));
		expect(resp.status).toBe(200);
		expect(resp.body.diary_entries.every((e) => e != null)).toBe(true);
	});
});

describe("workout body + ownership", () => {
	let owner;
	let other;
	let workout_id;
	let body;

	beforeAll(async () => {
		owner = await registerUser("lifter");
		other = await registerUser("snoop");
		const catalog = await ExerciseCatalogModel.create({ name: "Shape Squat", muscle_group: "legs" });
		body = {
			workout_name: "Leg day",
			workout_date: "2026-10-05",
			notes: "",
			finished_at: null,
			exercises: [{ catalog_id: catalog.catalog_id, notes: "", order_number: 1, sets: [{ order_number: 1, set_type: "working", notes: "", reps: 5, weight: 200, reps_in_reserve: 2 }] }],
		};
		await request(app).post("/workouts").set(bearer(owner)).send(body);
		workout_id = (await request(app).get("/workouts").set(bearer(owner))).body.workouts[0].id;
	});

	test("create: missing exercises or sets -> 400, empty arrays are fine", async () => {
		const create = (b) => request(app).post("/workouts").set(bearer(owner)).send(b);
		const { exercises, ...no_exercises } = body;

		expect((await create(no_exercises)).status).toBe(400);
		expect((await create({ ...body, exercises: "abc" })).status).toBe(400);
		expect((await create({ ...body, exercises: [{ ...exercises[0], sets: undefined }] })).status).toBe(400);
		expect((await create({ ...body, exercises: [] })).status).toBe(200);
		expect((await create({ ...body, exercises: [{ ...exercises[0], sets: [] }] })).status).toBe(200);
	});

	test("edit: a missing exercises list is a 400 and doesn't wipe the workout", async () => {
		const { exercises, ...no_exercises } = body;
		const resp = await request(app).put(`/workouts/${workout_id}`).set(bearer(owner)).send(no_exercises);
		expect(resp.status).toBe(400);

		const after = await request(app).get(`/workouts/${workout_id}`).set(bearer(owner));
		expect(after.body.workout.exercises).toHaveLength(1);
	});

	test("someone else's workout: edit and delete are 404, same as GET", async () => {
		expect((await request(app).get(`/workouts/${workout_id}`).set(bearer(other))).status).toBe(404);
		expect((await request(app).put(`/workouts/${workout_id}`).set(bearer(other)).send(body)).status).toBe(404);
		expect((await request(app).delete(`/workouts/${workout_id}`).set(bearer(other))).status).toBe(404);

		//still there for the owner
		expect((await request(app).get(`/workouts/${workout_id}`).set(bearer(owner))).status).toBe(200);
	});
});
