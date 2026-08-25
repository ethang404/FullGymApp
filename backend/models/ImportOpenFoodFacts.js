/**
 * Open Food Facts Import Script
 *
 * Imports foods and nutrients from the Open Food Facts CSV dump into your database.
 * Matches the same schema as the USDA import foods + food_nutrients tables.
 *
 * Download the dump from:
 *   https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz
 * Extract it, then set CSV_PATH below.
 *
 * Usage:
 *   node ImportOpenFoodFacts.js
 */

require("dotenv").config({ path: "../.env" });
console.log("DB URL:", process.env.DB_CONNECTION_URL);

const fs = require("fs");
const { parse } = require("csv-parse");
const { food, foodNutrient, foodServingSize } = require("./modelInits");
const sequelize = require("./db");
const { findDensityForFood } = require("../Nutrition/unitConversion");

// ─── CONFIG ──────────────────────────────────────────────────────────────────

// Path to the extracted OFF CSV file (it's one big file, ~9GB uncompressed)
const CSV_PATH = "C:\\Users\\Ethan\\OneDrive\\Desktop\\PersonalProjects\\DataImport\\en.openfoodfacts.org.products.csv\\en.openfoodfacts.org.products.csv";

// How many rows to insert at once
const BATCH_SIZE = 1000;

// Set to a number for testing, or null/0 to import everything
const TEST_LIMIT = null;

// Only import rows that have AT LEAST these nutrients present
// This filters out the huge number of incomplete/junk entries in OFF
const REQUIRED_FIELDS = ["energy-kcal_100g", "proteins_100g", "carbohydrates_100g", "fat_100g"];

// Minimum calorie value — filters out water, air, clearly broken entries
const MIN_CALORIES = 1;

// ─── NUTRIENT FIELD MAP ───────────────────────────────────────────────────────

// Maps OFF CSV column names → your nutrient_id and nutrient_name
// These match the same nutrient IDs used in the USDA import for consistency
const NUTRIENT_MAP = [
	{ offField: "energy-kcal_100g", nutrientId: 1008, name: "Energy", unit: "KCAL" },
	{ offField: "proteins_100g", nutrientId: 1003, name: "Protein", unit: "G" },
	{ offField: "fat_100g", nutrientId: 1004, name: "Total lipid (fat)", unit: "G" },
	{ offField: "carbohydrates_100g", nutrientId: 1005, name: "Carbohydrate, by difference", unit: "G" },
	{ offField: "fiber_100g", nutrientId: 1079, name: "Fiber, total dietary", unit: "G" },
	{ offField: "sugars_100g", nutrientId: 2000, name: "Total Sugars", unit: "G" },
	{ offField: "saturated-fat_100g", nutrientId: 1258, name: "Fatty acids, total saturated", unit: "G" },
	{ offField: "trans-fat_100g", nutrientId: 1257, name: "Fatty acids, total trans", unit: "G" },
	{ offField: "sodium_100g", nutrientId: 1093, name: "Sodium, Na", unit: "MG" },
	{ offField: "potassium_100g", nutrientId: 1092, name: "Potassium, K", unit: "MG" },
	{ offField: "calcium_100g", nutrientId: 1087, name: "Calcium, Ca", unit: "MG" },
	{ offField: "iron_100g", nutrientId: 1089, name: "Iron, Fe", unit: "MG" },
	{ offField: "vitamin-c_100g", nutrientId: 1162, name: "Vitamin C, total ascorbic acid", unit: "MG" },
	{ offField: "caffeine_100g", nutrientId: 1057, name: "Caffeine", unit: "MG" },
];

// OFF stores sodium in grams per 100g, but your DB stores it in mg (like USDA)
// Same for potassium, calcium, iron, vitamin C, caffeine
// These nutrient IDs need to be multiplied by 1000 on import
const CONVERT_G_TO_MG = new Set([1093, 1092, 1087, 1089, 1162, 1057]);

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const toFloat = (val) => {
	if (!val || val.trim() === "") return null;
	const parsed = parseFloat(val);
	return isNaN(parsed) ? null : parsed;
};

// Parses serving size from OFF's free-text field
// OFF stores serving_size as strings like "30g", "1 cup (240ml)", "2 tbsp"
// We want to extract the gram value where possible
const parseServingGrams = (servingSizeStr, foodName, brand) => {
	if (!servingSizeStr) return null;

	// Try to match "Xg" or "X g" — most common format
	const gramsMatch = servingSizeStr.match(/(\d+(?:\.\d+)?)\s*g\b/i);
	if (gramsMatch) return parseFloat(gramsMatch[1]);

	// Try to match "Xml" — resolve via a density lookup instead of assuming
	// 1ml ≈ 1g, which is wrong for anything that isn't water-density (oil,
	// honey, syrup, etc.). If no density match, leave it unresolved rather
	// than guessing.
	const mlMatch = servingSizeStr.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
	if (mlMatch) {
		const gPerMl = findDensityForFood(foodName, brand);
		return gPerMl != null ? parseFloat(mlMatch[1]) * gPerMl : null;
	}

	// Can't parse it — return null, we just won't have a serving size
	return null;
};

// Checks that a row has all required nutrient fields with valid values
const hasRequiredFields = (row) => {
	return REQUIRED_FIELDS.every((field) => {
		const val = toFloat(row[field]);
		return val !== null;
	});
};

// ─── MAIN IMPORT ─────────────────────────────────────────────────────────────

async function importOpenFoodFacts() {
	console.log("\n=== Open Food Facts Import ===");
	console.log("Streaming CSV — this will take a while (file is ~9GB)...\n");

	let foodBatch = [];
	let nutrientQueue = []; // nutrients waiting for their food's DB id
	let totalFoods = 0;
	let totalNutrients = 0;
	let totalSkipped = 0;
	let count = 0;

	const parser = fs.createReadStream(CSV_PATH).pipe(
		parse({
			columns: true,
			trim: true,
			relax_column_count: true,
			skip_empty_lines: true,
			bom: true,
			delimiter: "\t", // OFF is tab-separated
			quote: false, // disable strict quote parsing: OFF data has unescaped quotes in product names
			relax_quotes: true, // extra safety for malformed quote characters
		}),
	);

	for await (const row of parser) {
		count++;

		if (count % 100000 === 0) {
			console.log(`  ...processed ${count} rows | foods: ${totalFoods} | skipped: ${totalSkipped}`);
		}

		if (TEST_LIMIT && count > TEST_LIMIT) {
			console.log(`  TEST_LIMIT reached at row ${count}`);
			break;
		}

		// ── FILTER: skip rows without a product name
		const name = row.product_name?.trim();
		if (!name) {
			totalSkipped++;
			continue;
		}

		// ── FILTER: skip rows missing the core macros
		if (!hasRequiredFields(row)) {
			totalSkipped++;
			continue;
		}

		// ── FILTER: skip rows with suspiciously low calories (broken data)
		const calories = toFloat(row["energy-kcal_100g"]);
		if (!calories || calories < MIN_CALORIES) {
			totalSkipped++;
			continue;
		}

		// ── FILTER: skip rows with clearly impossible macro values
		// Total macros can't exceed 100g per 100g of food
		const protein = toFloat(row["proteins_100g"]) ?? 0;
		const fat = toFloat(row["fat_100g"]) ?? 0;
		const carbs = toFloat(row["carbohydrates_100g"]) ?? 0;
		if (protein + fat + carbs > 105) {
			// small tolerance for rounding
			totalSkipped++;
			continue;
		}

		// ── Build the food row
		const brandForServing = row.brands?.split(",")[0]?.trim() || null;
		const servingSizeRaw = row.serving_size || row.serving_quantity || null;
		const servingSizeG = parseServingGrams(servingSizeRaw, name, brandForServing);

		// OFF serving_size is a string like "30g" — keep original as the label
		// but only if it's a human-readable label (not just "30g" which is useless)
		const hasHumanLabel = servingSizeRaw && !/^\d+(\.\d+)?\s*(g|ml)$/i.test(servingSizeRaw.trim());
		const servingSizeLabel = hasHumanLabel ? servingSizeRaw : null;

		const foodRow = {
			name,
			brand: row.brands?.split(",")[0]?.trim() || null, // OFF can have multiple brands
			barcode: row.code || null,
			serving_size_g: servingSizeG,
			serving_size_label: servingSizeLabel,
			source: "off", // distinguishes from "usda" rows
			submitted_by: null,
			is_deleted: false,
			// No fdc_id for OFF foods — that column should be nullable in your schema
		};

		// Collect nutrients for this row — we'll link them after insert
		const rowNutrients = [];
		for (const { offField, nutrientId, name: nutrientName, unit } of NUTRIENT_MAP) {
			let amount = toFloat(row[offField]);
			if (amount === null) continue;

			// Convert g → mg for nutrients stored in mg in your DB
			if (CONVERT_G_TO_MG.has(nutrientId)) {
				amount = amount * 1000;
			}

			rowNutrients.push({
				nutrient_id: nutrientId,
				nutrient_name: nutrientName,
				unit,
				amount_per_100g: amount,
			});
		}

		foodBatch.push({ foodRow, rowNutrients });

		// ── Flush when batch is full
		if (foodBatch.length >= BATCH_SIZE) {
			const inserted = await flushFoodBatch(foodBatch);
			totalFoods += inserted.foods;
			totalNutrients += inserted.nutrients;
			foodBatch = [];
		}
	}

	// ── Final flush
	if (foodBatch.length > 0) {
		const inserted = await flushFoodBatch(foodBatch);
		totalFoods += inserted.foods;
		totalNutrients += inserted.nutrients;
	}

	console.log(`\n=== Done ===`);
	console.log(`  Foods inserted:     ${totalFoods}`);
	console.log(`  Nutrients inserted: ${totalNutrients}`);
	console.log(`  Rows skipped:       ${totalSkipped}`);
}

// ─── BATCH INSERT ─────────────────────────────────────────────────────────────

// Inserts a batch of foods, gets back their DB UUIDs,
// then inserts all their nutrients linked to those UUIDs
async function flushFoodBatch(batch) {
	const foodRows = batch.map((b) => b.foodRow);

	// Insert foods and get back the generated UUIDs
	const inserted = await food.bulkCreate(foodRows, {
		ignoreDuplicates: true,
		returning: true,
	});

	// Build a lookup: barcode (or name) → db UUID
	// We need this to link nutrients back to the right food
	// OFF foods always have a barcode, so that's the most reliable key
	const insertedMap = new Map();
	for (const f of inserted) {
		if (f.barcode) insertedMap.set(f.barcode, f.id);
		else insertedMap.set(f.name, f.id);
	}

	// Now build nutrient rows linked to the inserted food UUIDs
	const nutrientRows = [];
	const servingSizeRows = [];
	for (const { foodRow, rowNutrients } of batch) {
		const foodId = foodRow.barcode ? insertedMap.get(foodRow.barcode) : insertedMap.get(foodRow.name);

		if (!foodId) continue; // was a duplicate, skip its nutrients too

		for (const nutrient of rowNutrients) {
			nutrientRows.push({
				food_id: foodId,
				...nutrient,
			});
		}

		// Previously never populated — food.model.js has no serving_size_g/
		// serving_size_label columns, so those keys on foodRow were silently
		// dropped by bulkCreate above. Insert the real food_serving_sizes row
		// here instead, now that we have the food's generated id.
		if (foodRow.serving_size_g) {
			servingSizeRows.push({
				food_id: foodId,
				label: foodRow.serving_size_label || "serving",
				weight_g: foodRow.serving_size_g,
			});
		}
	}

	if (nutrientRows.length > 0) {
		await foodNutrient.bulkCreate(nutrientRows, { ignoreDuplicates: true });
	}
	if (servingSizeRows.length > 0) {
		await foodServingSize.bulkCreate(servingSizeRows, { ignoreDuplicates: true });
	}

	return { foods: inserted.length, nutrients: nutrientRows.length };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
	const startTime = Date.now();

	try {
		await sequelize.authenticate();
		console.log("DB connection established");

		await importOpenFoodFacts();

		const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
		console.log(`\nCompleted in ${elapsed} minutes`);
	} catch (err) {
		console.error("Import failed:", err);
		process.exit(1);
	} finally {
		await sequelize.close();
	}
}

main();
