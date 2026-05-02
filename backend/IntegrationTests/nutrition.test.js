const request = require("supertest");
const app = require("../app");
//const { sequelize } = require("../models/modelInits");
const sequelize = require("../models/db");

const FoodModel = require("../models/modelInits").food;
const FoodServingSizeModel = require("../models/modelInits").foodServingSize;
const DiaryEntryModel = require("../models/modelInits").diaryEntries;
const RecipeModel = require("../models/modelInits").recipe;
const RecipeIngredModel = require("../models/modelInits").recipeIngredient;

const {
	addUserPayload,
	addFoodPayload,
	addDiaryEntryPayload,
	editDiaryEntryPayload,
	addDiaryEntryServingPayload,
	createRecipePayload,
} = require("./TestPayloads");

let token;
let createdFoodId;
let createdEntryId;
let createdRecipeId;
let createdRecipeDiaryEntryId;

beforeAll(async () => {
	await sequelize.sync({ force: true });
	await sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

	const resp = await request(app).post("/auth/register").set("Content-Type", "application/json").send(addUserPayload);

	token = resp.body.accessToken;
});

afterAll(async () => {
	await sequelize.close();
});

// ─────────────────────────────────────────────
// FOODS
// ─────────────────────────────────────────────

describe("Food Endpoints", () => {
	test("Create Food - 201 and correct DB state", async () => {
		const resp = await request(app)
			.post("/nutrition/foods")
			.set("Content-Type", "application/json")
			.set("Authorization", `Bearer ${token}`)
			.send(addFoodPayload);

		expect(resp.status).toBe(201);

		// Controller wraps in { food }
		expect(resp.body.food).toBeDefined();
		expect(resp.body.food.id).toBeDefined();
		createdFoodId = resp.body.food.id;

		// Response shape from formatFood
		expect(resp.body.food.name).toBe(addFoodPayload.name);
		expect(resp.body.food.brand).toBe(addFoodPayload.brand);
		expect(resp.body.food.source).toBe("user_submitted");
		expect(Array.isArray(resp.body.food.serving_sizes)).toBe(true);
		expect(resp.body.food.serving_sizes.length).toBe(addFoodPayload.serving_sizes.length);
		expect(resp.body.food.macros_per_100g).toBeDefined();

		// DB: food row
		const food = await FoodModel.findByPk(createdFoodId);
		expect(food).not.toBeNull();
		expect(food.name).toBe(addFoodPayload.name);
		expect(food.source).toBe("user_submitted");

		// DB: serving sizes
		const servingSizes = await FoodServingSizeModel.findAll({ where: { food_id: createdFoodId } });
		expect(servingSizes.length).toBe(addFoodPayload.serving_sizes.length);
		const labels = servingSizes.map((s) => s.label);
		for (const ss of addFoodPayload.serving_sizes) {
			expect(labels).toContain(ss.label);
		}
	});

	test("Search Foods - returns results with correct shape", async () => {
		const resp = await request(app).get("/nutrition/foods?query=Chicken").set("Authorization", `Bearer ${token}`);

		expect(resp.status).toBe(200);

		// Controller wraps in { foods }
		expect(resp.body.foods).toBeDefined();
		expect(Array.isArray(resp.body.foods)).toBe(true);
		expect(resp.body.foods.length).toBeGreaterThan(0);

		const match = resp.body.foods.find((f) => f.id === createdFoodId);
		expect(match).toBeDefined();
		expect(match.name).toBe(addFoodPayload.name);
		expect(match.macros_per_100g).toBeDefined();
		expect(Array.isArray(match.serving_sizes)).toBe(true);
		expect(match.serving_sizes.length).toBeGreaterThan(0);

		// Verify serving size shape from formatFood
		const serving = match.serving_sizes.find((s) => s.label === "serving");
		expect(serving).toBeDefined();
		expect(serving.weight_g).toBe(140);
	});

	test("Search Foods - empty query returns 400", async () => {
		const resp = await request(app).get("/nutrition/foods?query=").set("Authorization", `Bearer ${token}`);

		expect(resp.status).toBe(400);
	});
});

// ─────────────────────────────────────────────
// DIARY ENTRIES
// ─────────────────────────────────────────────

describe("Diary Entry Endpoints", () => {
	test("Add Diary Entry (grams) - 201 and correct DB state", async () => {
		const payload = { ...addDiaryEntryPayload, food_id: createdFoodId };

		const resp = await request(app).post("/nutrition/diary").set("Content-Type", "application/json").set("Authorization", `Bearer ${token}`).send(payload);

		expect(resp.status).toBe(201);

		// Controller wraps in { diary_entry }
		const entry = resp.body.diary_entry;
		expect(entry).toBeDefined();
		expect(entry.id).toBeDefined();
		createdEntryId = entry.id;

		// Shape from formatFoodEntry
		expect(entry.type).toBe("food");
		expect(entry.meal_type).toBe(payload.meal_type);
		expect(entry.logged_at).toBe(payload.logged_at);
		expect(entry.quantity).toBe(payload.quantity);
		expect(entry.unit).toBe(payload.unit);
		expect(entry.food.id).toBe(createdFoodId);
		expect(entry.food.name).toBe(addFoodPayload.name);

		// Nutrients are null on save path - addDiaryEntry skips the fetch
		expect(entry.nutrients).toBeNull();

		// DB
		const dbEntry = await DiaryEntryModel.findByPk(createdEntryId);
		expect(dbEntry).not.toBeNull();
		expect(dbEntry.food_id).toBe(createdFoodId);
		expect(dbEntry.recipe_id).toBeNull();
		expect(dbEntry.meal_type).toBe(payload.meal_type);
		expect(dbEntry.logged_at).toBe(payload.logged_at);
		expect(parseFloat(dbEntry.quantity)).toBe(payload.quantity);
		expect(dbEntry.unit).toBe(payload.unit);
	});

	test("Add Diary Entry (named serving) - resolves via food_serving_sizes", async () => {
		const payload = { ...addDiaryEntryServingPayload, food_id: createdFoodId };

		const resp = await request(app).post("/nutrition/diary").set("Content-Type", "application/json").set("Authorization", `Bearer ${token}`).send(payload);

		expect(resp.status).toBe(201);

		const entry = resp.body.diary_entry;
		expect(entry.unit).toBe("serving");
		expect(entry.quantity).toBe(2);
		expect(entry.nutrients).toBeNull(); // save path - no nutrients
	});

	test("Add Diary Entry - invalid unit returns 400", async () => {
		const payload = {
			...addDiaryEntryPayload,
			food_id: createdFoodId,
			unit: "tablespoon", // not in serving_sizes for this food
		};

		const resp = await request(app).post("/nutrition/diary").set("Content-Type", "application/json").set("Authorization", `Bearer ${token}`).send(payload);

		expect(resp.status).toBe(400);
	});

	test("Get Diary Entries - returns entries with calculated nutrients", async () => {
		const resp = await request(app).get("/nutrition/diary?start_date=2025-01-15&end_date=2025-01-15").set("Authorization", `Bearer ${token}`);

		expect(resp.status).toBe(200);

		// Controller wraps in { diary_entries }
		const entries = resp.body.diary_entries;
		expect(Array.isArray(entries)).toBe(true);
		expect(entries.length).toBeGreaterThan(0);

		const entry = entries.find((e) => e.id === createdEntryId);
		expect(entry).toBeDefined();
		expect(entry.type).toBe("food");
		expect(entry.food.id).toBe(createdFoodId);

		// Nutrients are fully populated on the read path
		expect(entry.nutrients).not.toBeNull();
		expect(entry.nutrients["Energy"]).toBeDefined();
		expect(entry.nutrients["Protein"]).toBeDefined();

		// 200g chicken, 31g protein per 100g → multiplier 2.0 → 62g
		expect(entry.nutrients["Protein"]).toBeCloseTo(62, 1);
		// 200g chicken, 165 kcal per 100g → 330 kcal
		expect(entry.nutrients["Energy"]).toBeCloseTo(330, 1);
	});

	test("Get Diary Entries - meal_type filter works", async () => {
		const resp = await request(app).get("/nutrition/diary?start_date=2025-01-15&end_date=2025-01-15&meal_type=lunch").set("Authorization", `Bearer ${token}`);

		expect(resp.status).toBe(200);
		const entries = resp.body.diary_entries;
		// Every returned entry must be lunch
		for (const e of entries) {
			expect(e.meal_type).toBe("lunch");
		}
	});

	test("Get Diary Entries - missing start_date returns 400", async () => {
		const resp = await request(app).get("/nutrition/diary").set("Authorization", `Bearer ${token}`);

		expect(resp.status).toBe(400);
	});

	test("Edit Diary Entry - 200 and recalculated nutrients", async () => {
		const resp = await request(app)
			.put(`/nutrition/diary/${createdEntryId}`)
			.set("Content-Type", "application/json")
			.set("Authorization", `Bearer ${token}`)
			.send(editDiaryEntryPayload);

		expect(resp.status).toBe(200);

		// Controller wraps in { diary_entry }
		const entry = resp.body.diary_entry;
		expect(entry).toBeDefined();

		// Edit path refetches with joins, so nutrients must be populated
		expect(entry.nutrients).not.toBeNull();
		expect(entry.meal_type).toBe(editDiaryEntryPayload.meal_type);
		expect(entry.quantity).toBe(editDiaryEntryPayload.quantity);
		expect(entry.unit).toBe(editDiaryEntryPayload.unit);

		// 150g chicken, 31g protein per 100g → 46.5g
		expect(entry.nutrients["Protein"]).toBeCloseTo(46.5, 1);
		// 150g chicken, 165 kcal per 100g → 247.5 kcal
		expect(entry.nutrients["Energy"]).toBeCloseTo(247.5, 1);

		// DB
		const dbEntry = await DiaryEntryModel.findByPk(createdEntryId);
		expect(parseFloat(dbEntry.quantity)).toBe(editDiaryEntryPayload.quantity);
		expect(dbEntry.unit).toBe(editDiaryEntryPayload.unit);
		expect(dbEntry.meal_type).toBe(editDiaryEntryPayload.meal_type);
		expect(dbEntry.logged_at).toBe(editDiaryEntryPayload.logged_at);
	});

	test("Delete Diary Entry - 200 and removed from DB", async () => {
		const resp = await request(app).delete(`/nutrition/diary/${createdEntryId}`).set("Authorization", `Bearer ${token}`);

		expect(resp.status).toBe(200);
		expect(resp.body.deleted).toBe(true);
		expect(resp.body.id).toBe(createdEntryId);

		const dbEntry = await DiaryEntryModel.findByPk(createdEntryId);
		expect(dbEntry).toBeNull();
	});
});

// ─────────────────────────────────────────────
// RECIPES
// ─────────────────────────────────────────────

describe("Recipe Endpoints", () => {
	test("Create Recipe - 201 and correct DB state", async () => {
		const payload = {
			...createRecipePayload,
			ingredients: [{ ...createRecipePayload.ingredients[0], food_id: createdFoodId }],
		};

		const resp = await request(app).post("/nutrition/recipes").set("Content-Type", "application/json").set("Authorization", `Bearer ${token}`).send(payload);

		expect(resp.status).toBe(201);

		// Controller wraps in { recipe }
		const recipe = resp.body.recipe;
		expect(recipe).toBeDefined();
		expect(recipe.id).toBeDefined();
		createdRecipeId = recipe.id;

		// Shape from formatRecipe
		expect(recipe.name).toBe(payload.name);
		expect(recipe.description).toBe(payload.description);
		expect(recipe.servings).toBe(payload.servings);
		expect(recipe.totals).toBeDefined();
		expect(recipe.totals.calories).toBeGreaterThan(0);
		expect(recipe.totals.protein).toBeGreaterThan(0);
		expect(Array.isArray(recipe.ingredients)).toBe(true);
		expect(recipe.ingredients.length).toBe(1);

		// Ingredient shape
		const ing = recipe.ingredients[0];
		expect(ing.food_id).toBe(createdFoodId);
		expect(ing.food_name).toBe(addFoodPayload.name);
		expect(parseFloat(ing.quantity)).toBe(200);
		expect(ing.unit).toBe("g");
		expect(ing.calories).not.toBeNull();
		expect(ing.protein).not.toBeNull();

		// 200g chicken, 31g protein per 100g → 62g stored on ingredient
		expect(ing.protein).toBeCloseTo(62, 1);

		// DB: recipe row
		const dbRecipe = await RecipeModel.findByPk(createdRecipeId, {
			include: [{ model: RecipeIngredModel }],
		});
		expect(dbRecipe).not.toBeNull();
		expect(dbRecipe.name).toBe(payload.name);
		expect(parseFloat(dbRecipe.servings)).toBe(payload.servings);
		expect(dbRecipe.recipeIngredients.length).toBe(1);

		// DB: macros pre-stored on ingredient
		const dbIng = dbRecipe.recipeIngredients[0];
		expect(dbIng.food_id).toBe(createdFoodId);
		expect(dbIng.protein).not.toBeNull();
		expect(dbIng.calories).not.toBeNull();
	});

	test("Get All Recipes - returns created recipe", async () => {
		const resp = await request(app).get("/nutrition/recipes").set("Authorization", `Bearer ${token}`);

		expect(resp.status).toBe(200);

		// Controller wraps in { recipes }
		expect(Array.isArray(resp.body.recipes)).toBe(true);
		expect(resp.body.recipes.length).toBeGreaterThan(0);

		const match = resp.body.recipes.find((r) => r.id === createdRecipeId);
		expect(match).toBeDefined();
		expect(match.name).toBe(createRecipePayload.name);
		expect(match.servings).toBe(createRecipePayload.servings);
		expect(match.totals).toBeDefined();
		expect(match.ingredients.length).toBe(1);
	});

	test("Get Single Recipe - returns correct shape", async () => {
		const resp = await request(app).get(`/nutrition/recipes/${createdRecipeId}`).set("Authorization", `Bearer ${token}`);

		expect(resp.status).toBe(200);

		// Controller wraps in { recipe }
		const recipe = resp.body.recipe;
		expect(recipe.id).toBe(createdRecipeId);
		expect(recipe.name).toBe(createRecipePayload.name);
		expect(recipe.servings).toBe(createRecipePayload.servings);
		expect(recipe.ingredients.length).toBe(1);
		expect(recipe.ingredients[0].food_name).toBe(addFoodPayload.name);
		expect(recipe.totals.protein).toBeCloseTo(62, 1);
	});

	test("Update Recipe - name and description update", async () => {
		const resp = await request(app)
			.put(`/nutrition/recipes/${createdRecipeId}`)
			.set("Content-Type", "application/json")
			.set("Authorization", `Bearer ${token}`)
			.send({ name: "Updated Lunch", description: "Updated desc", servings: 3 });

		expect(resp.status).toBe(200);
		const recipe = resp.body.recipe;
		expect(recipe.name).toBe("Updated Lunch");
		expect(recipe.description).toBe("Updated desc");
		expect(recipe.servings).toBe(3);

		// Ingredients unchanged
		expect(recipe.ingredients.length).toBe(1);
	});

	test("Log Recipe as Diary Entry - save path returns null nutrients", async () => {
		const payload = {
			recipe_id: createdRecipeId,
			meal_type: "lunch",
			logged_at: "2025-01-16",
			quantity: 1,
			unit: "serving",
		};

		const resp = await request(app).post("/nutrition/diary").set("Content-Type", "application/json").set("Authorization", `Bearer ${token}`).send(payload);

		expect(resp.status).toBe(201);

		const entry = resp.body.diary_entry;
		expect(entry.type).toBe("recipe");
		// formatRecipeEntry uses recipe.recipe_id as id
		expect(entry.recipe.id).toBe(createdRecipeId);
		expect(entry.recipe.servings).toBe(3); // updated to 3 above
		expect(entry.quantity).toBe(1);
		expect(entry.unit).toBe("serving");

		// Save path: no nutrient calculation
		expect(entry.nutrients).toBeNull();

		// DB
		const dbEntry = await DiaryEntryModel.findByPk(entry.id);
		expect(dbEntry.recipe_id).toBe(createdRecipeId);
		expect(dbEntry.food_id).toBeNull();

		createdRecipeDiaryEntryId = entry.id;
	});

	test("Get Diary Entries - recipe entry has scaled nutrients on read path", async () => {
		const resp = await request(app).get("/nutrition/diary?start_date=2025-01-16").set("Authorization", `Bearer ${token}`);

		expect(resp.status).toBe(200);

		const entries = resp.body.diary_entries;
		const entry = entries.find((e) => e.id === createdRecipeDiaryEntryId);
		expect(entry).toBeDefined();
		expect(entry.nutrients).not.toBeNull();

		// Recipe was updated to 3 servings. Ingredient: 200g chicken = 62g protein total.
		// scale = 1 / 3 → protein ≈ 20.67g
		expect(entry.nutrients.protein).toBeCloseTo(62 / 3, 1);
	});

	test("Add Recipe Ingredient - ingredient added with pre-stored macros", async () => {
		const payload = { food_id: createdFoodId, quantity: 100, unit: "g" };

		const resp = await request(app)
			.post(`/nutrition/recipes/${createdRecipeId}/ingredients`)
			.set("Content-Type", "application/json")
			.set("Authorization", `Bearer ${token}`)
			.send(payload);

		expect(resp.status).toBe(201);

		// Controller wraps in { ingredient }
		const ing = resp.body.ingredient;
		expect(ing).toBeDefined();
		expect(ing.food_id).toBe(createdFoodId);
		expect(parseFloat(ing.quantity)).toBe(100);

		// 100g chicken, 31g protein per 100g → 31g stored
		expect(parseFloat(ing.protein)).toBeCloseTo(31, 1);

		// DB: now 2 ingredients
		const dbIngredients = await RecipeIngredModel.findAll({ where: { recipe_id: createdRecipeId } });
		expect(dbIngredients.length).toBe(2);
	});

	test("Remove Recipe Ingredient - ingredient removed from DB", async () => {
		// Get the ingredient we just added
		const allIngs = await RecipeIngredModel.findAll({ where: { recipe_id: createdRecipeId } });
		const toRemove = allIngs[allIngs.length - 1]; // the one we just added

		const resp = await request(app)
			.delete(`/nutrition/recipes/${createdRecipeId}/ingredients/${toRemove.ingredient_id}`)
			.set("Authorization", `Bearer ${token}`);

		expect(resp.status).toBe(200);
		expect(resp.body.deleted).toBe(true);
		expect(resp.body.ingredient_id).toBe(toRemove.ingredient_id);

		// DB: back to 1 ingredient
		const remaining = await RecipeIngredModel.findAll({ where: { recipe_id: createdRecipeId } });
		expect(remaining.length).toBe(1);
	});

	test("Delete Recipe - cascades to ingredients", async () => {
		const resp = await request(app).delete(`/nutrition/recipes/${createdRecipeId}`).set("Authorization", `Bearer ${token}`);

		expect(resp.status).toBe(200);
		expect(resp.body.deleted).toBe(true);
		expect(resp.body.id).toBe(createdRecipeId);

		// Recipe gone
		const dbRecipe = await RecipeModel.findByPk(createdRecipeId);
		expect(dbRecipe).toBeNull();

		// Ingredients cascade deleted
		const dbIngs = await RecipeIngredModel.findAll({ where: { recipe_id: createdRecipeId } });
		expect(dbIngs.length).toBe(0);
	});
});
