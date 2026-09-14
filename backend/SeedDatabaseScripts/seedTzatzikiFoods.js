// Seeds the food items needed to build "Homemade Tzatziki Sauce" end to end,
// for manually testing the recipe-URL-import feature (backend/Nutrition/recipeImport.js
// + frontend CreateRecipe.tsx's auto-matcher): import the URL below in the app,
// and every ingredient should now resolve to a food already in the DB.
//
// Real recipe: https://www.skinnytaste.com/tzatziki/
// Ingredient strings below are exactly what parseRecipeFromHtml() returned when
// run against that page's actual JSON-LD on 2026-09-11 - not typed by hand.
//
// Nutrition figures are approximate (USDA-style generic values, or typical
// Costco Kirkland Signature label data for the one branded item) - good enough
// to exercise the app end to end, NOT medical-grade or verified against a
// current label.
//
// Safe to re-run: each food is looked up by name+brand first and left alone if
// it already exists (mirrors "assume it's already there" - only missing foods
// get created). Delete a row from the `foods` table (cascades to its nutrients
// /servings) if you want to reseed it from scratch.
//
// Run with:  cd backend && node SeedDatabaseScripts/seedTzatzikiFoods.js
//
// NOTE: backend/IntegrationTests/*.test.js wipe the whole DB
// (sequelize.sync({force:true}) in beforeAll). Run `npm test` BEFORE this
// script if you want to keep the seeded foods around for manual app testing.

require("dotenv").config();
const bcrypt = require("bcrypt");
const { users, food: FoodModel } = require("../models/modelInits");
const service = require("../Nutrition/service");
const sequelize = require("../models/db");

const SEED_USERNAME = "recipe_demo";
const SEED_PASSWORD = "RecipeDemo123!";

const SOURCE_RECIPE = {
	url: "https://www.skinnytaste.com/tzatziki/",
	name: "Homemade Tzatziki Sauce Recipe",
	// For reference only - not consumed programmatically. This is the actual
	// `ingredients` array POST /nutrition/recipes/import returned for this URL.
	ingredients: [
		"8 oz fat-free Greek yogurt (use full fat for Keto)",
		"1 small cucumber (peeled and seeded (1 cup grated and squeezed dry))",
		"1 clove garlic (crushed)",
		"1 tsp lemon juice",
		"1 tbsp fresh dill (chopped)",
		"1 tbsp fresh chives (chopped)",
		"kosher salt and fresh pepper",
	],
};

// One entry per food this recipe needs. `nutrients[].nutrient_amount` is the
// amount AT serving_sizes[0]'s weight - CreateFood normalizes to per-100g from
// there, same shape POST /nutrition/foods expects (see NutritionPayloads.js).
const FOODS = [
	{
		// The "assuming that food already exists" example from the ask - a
		// branded product a generic USDA import wouldn't carry.
		name: "Kirkland Signature Nonfat Greek Yogurt, Plain",
		brand: "Kirkland Signature",
		nutrients: [
			{ nutrient_name: "calories", unit: "kcal", nutrient_amount: 90 },
			{ nutrient_name: "protein", unit: "g", nutrient_amount: 16 },
			{ nutrient_name: "carbs", unit: "g", nutrient_amount: 6 },
			{ nutrient_name: "fat", unit: "g", nutrient_amount: 0 },
			{ nutrient_name: "sugar", unit: "g", nutrient_amount: 6 },
			{ nutrient_name: "sodium", unit: "mg", nutrient_amount: 60 },
		],
		serving_sizes: [
			{ label: "serving", weight_g: 170, default_quantity: 1 }, // FDA label serving (6oz)
			{ label: "cup", weight_g: 245 },
		],
	},
	{
		name: "Cucumber, Raw",
		brand: null,
		nutrients: [
			{ nutrient_name: "calories", unit: "kcal", nutrient_amount: 22.5 }, // 15 kcal/100g * 150g
			{ nutrient_name: "protein", unit: "g", nutrient_amount: 0.98 },
			{ nutrient_name: "carbs", unit: "g", nutrient_amount: 5.45 },
			{ nutrient_name: "fat", unit: "g", nutrient_amount: 0.17 },
		],
		serving_sizes: [
			{ label: "serving", weight_g: 150, default_quantity: 1 }, // ~1 small cucumber, whole
			{ label: "cup", weight_g: 120 }, // grated + squeezed dry, per the recipe's own note
		],
	},
	{
		name: "Garlic, Raw",
		brand: null,
		nutrients: [
			{ nutrient_name: "calories", unit: "kcal", nutrient_amount: 4.47 }, // 149 kcal/100g * 3g
			{ nutrient_name: "protein", unit: "g", nutrient_amount: 0.19 },
			{ nutrient_name: "carbs", unit: "g", nutrient_amount: 0.99 },
			{ nutrient_name: "fat", unit: "g", nutrient_amount: 0.02 },
		],
		serving_sizes: [{ label: "clove", weight_g: 3, default_quantity: 1 }],
	},
	{
		name: "Lemon Juice, Raw",
		brand: null,
		nutrients: [
			{ nutrient_name: "calories", unit: "kcal", nutrient_amount: 3.3 }, // 22 kcal/100g * 15g
			{ nutrient_name: "protein", unit: "g", nutrient_amount: 0.05 },
			{ nutrient_name: "carbs", unit: "g", nutrient_amount: 1.04 },
			{ nutrient_name: "fat", unit: "g", nutrient_amount: 0.04 },
		],
		serving_sizes: [
			{ label: "tbsp", weight_g: 15 },
			{ label: "tsp", weight_g: 5 },
		],
	},
	{
		name: "Dill, Fresh",
		brand: null,
		nutrients: [
			{ nutrient_name: "calories", unit: "kcal", nutrient_amount: 0.47 }, // 43 kcal/100g * 1.1g
			{ nutrient_name: "protein", unit: "g", nutrient_amount: 0.04 },
			{ nutrient_name: "carbs", unit: "g", nutrient_amount: 0.08 },
			{ nutrient_name: "fat", unit: "g", nutrient_amount: 0.01 },
		],
		serving_sizes: [{ label: "tbsp", weight_g: 1.1 }],
	},
	{
		name: "Chives, Fresh",
		brand: null,
		nutrients: [
			{ nutrient_name: "calories", unit: "kcal", nutrient_amount: 0.9 }, // 30 kcal/100g * 3g
			{ nutrient_name: "protein", unit: "g", nutrient_amount: 0.1 },
			{ nutrient_name: "carbs", unit: "g", nutrient_amount: 0.13 },
			{ nutrient_name: "fat", unit: "g", nutrient_amount: 0.02 },
		],
		serving_sizes: [{ label: "tbsp", weight_g: 3 }],
	},
	{
		// The source line ("kosher salt and fresh pepper") names two
		// ingredients in one string - the auto-matcher can only resolve it to
		// one food, so both get seeded here for manual add / future splitting.
		name: "Kosher Salt",
		brand: null,
		nutrients: [
			{ nutrient_name: "calories", unit: "kcal", nutrient_amount: 0 },
			{ nutrient_name: "protein", unit: "g", nutrient_amount: 0 },
			{ nutrient_name: "carbs", unit: "g", nutrient_amount: 0 },
			{ nutrient_name: "fat", unit: "g", nutrient_amount: 0 },
			{ nutrient_name: "sodium", unit: "mg", nutrient_amount: 2300 },
		],
		serving_sizes: [{ label: "tsp", weight_g: 6 }],
	},
	{
		name: "Black Pepper, Ground",
		brand: null,
		nutrients: [
			{ nutrient_name: "calories", unit: "kcal", nutrient_amount: 5.77 }, // 251 kcal/100g * 2.3g
			{ nutrient_name: "protein", unit: "g", nutrient_amount: 0.24 },
			{ nutrient_name: "carbs", unit: "g", nutrient_amount: 1.47 },
			{ nutrient_name: "fat", unit: "g", nutrient_amount: 0.07 },
		],
		serving_sizes: [{ label: "tsp", weight_g: 2.3 }],
	},
];

async function ensureSubmitterUser() {
	let user = await users.findOne({ where: { user_name: SEED_USERNAME } });
	if (user) {
		console.log(`User "${SEED_USERNAME}" already exists (id ${user.user_id}), reusing.`);
		return user;
	}
	const hash = await bcrypt.hash(SEED_PASSWORD + process.env.PEPPER, await bcrypt.genSalt(10));
	user = await users.create({ first_name: "Recipe", last_name: "Demo", user_name: SEED_USERNAME, password: hash });
	console.log(`Created user "${SEED_USERNAME}" (id ${user.user_id}) to attribute seeded foods to.`);
	return user;
}

async function ensureFood(spec, submitter) {
	const existing = await FoodModel.findOne({ where: { name: spec.name, brand: spec.brand ?? null, is_deleted: false } });
	if (existing) {
		console.log(`- "${spec.name}"${spec.brand ? ` (${spec.brand})` : ""} already exists (id ${existing.id}) - reusing.`);
		return existing;
	}

	const created = await service.CreateFood({ name: spec.name, brand: spec.brand, nutrients: spec.nutrients, serving_sizes: spec.serving_sizes }, submitter.user_id);
	console.log(`- Created "${spec.name}"${spec.brand ? ` (${spec.brand})` : ""} (id ${created.id}).`);
	return created;
}

async function main() {
	try {
		console.log(`Seeding foods for: ${SOURCE_RECIPE.name}\n${SOURCE_RECIPE.url}\n`);
		const submitter = await ensureSubmitterUser();

		const results = [];
		for (const spec of FOODS) {
			results.push(await ensureFood(spec, submitter));
		}

		console.log(`\nDone - ${results.length} foods ready.`);
		console.log(`Now try: Import from a link -> ${SOURCE_RECIPE.url}`);
	} catch (err) {
		console.error("Seed failed:", err);
		process.exitCode = 1;
	} finally {
		await sequelize.close();
	}
}

main();
