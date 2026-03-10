/**
 * USDA FoodData Central Import Script
 *
 * Imports foods and nutrients from USDA CSV files into your database.
 *
 * Usage:
 *   node import.js
 *
 * Make sure to set the CSV_DIR path below to wherever you extracted the USDA zip.
 */

require("dotenv").config({ path: "../.env" });
console.log("DB URL:", process.env.DB_CONNECTION_URL);
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");
const { food, foodNutrient } = require("./modelInits");
const sequelize = require("./db");

// ─── CONFIG ──────────────────────────────────────────────────────────────────

// Path to the folder containing all the USDA CSV files
const CSV_DIR = "C:\\Users\\Ethan\\Downloads\\FoodData_Central_csv_2025-12-18\\FoodData_Central_csv_2025-12-18";

// How many rows to insert at once
// Higher = faster but more memory usage
const BATCH_SIZE = 1000;

const TEST_LIMIT = 100;

// Only import these food types — skip survey/lab/agricultural data
const ALLOWED_DATA_TYPES = ["branded_food", "foundation_food", "sr_legacy_food"];

// Only import these nutrients by USDA nutrient ID
const NUTRIENTS_TO_IMPORT = new Set([
	1008, // Calories (kcal)
	1003, // Protein (g)
	1004, // Fat (g)
	1005, // Carbohydrates (g)
	1079, // Fiber (g)
	2000, // Sugar (g)
	1258, // Saturated Fat (g)
	1257, // Trans Fat (g)
	1093, // Sodium (mg)
	1092, // Potassium (mg)
	1087, // Calcium (mg)
	1089, // Iron (mg)
	1090, // Magnesium (mg)
	1095, // Zinc (mg)
	1162, // Vitamin C (mg)
	1114, // Vitamin D (mcg)
	1106, // Vitamin A (mcg)
	1109, // Vitamin E (mg)
	1185, // Vitamin K (mcg)
	1178, // Vitamin B12 (mcg)
	1177, // Folate B9 (mcg)
	1175, // Vitamin B6 (mg)
	1057, // Caffeine (mg)
]);

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Helper to build the full path to a CSV file
const csvPath = (filename) => path.join(CSV_DIR, filename);

// Helper to parse a float safely — returns null if empty or invalid
const toFloat = (val) => {
	const parsed = parseFloat(val);
	return isNaN(parsed) ? null : parsed;
};

// Reads an entire CSV file into an array of objects
// Only use this for small files (nutrient.csv, food_portion.csv)
const loadCSV = (filename) =>
	new Promise((resolve, reject) => {
		const rows = [];
		fs.createReadStream(csvPath(filename))
			.pipe(parse({ columns: true, trim: true }))
			.on("data", (row) => rows.push(row))
			.on("end", () => {
				console.log(`  Loaded ${rows.length} rows from ${filename}`);
				resolve(rows);
			})
			.on("error", reject);
	});

// Streams a CSV file one row at a time using async iteration
// This properly supports await inside the loop unlike event callbacks
// Use this for large files (food.csv, branded_food.csv, food_nutrient.csv)
const streamCSV = async (filename, onRow) => {
	let count = 0;

	// create the read stream and pipe through csv parser
	const parser = fs.createReadStream(csvPath(filename)).pipe(parse({ columns: true, trim: true }));

	// async iteration — waits for onRow to finish before reading next row
	// this is the key difference vs .on('data') which doesn't await
	for await (const row of parser) {
		count++;
		if (count % 100000 === 0) {
			console.log(`  ...processed ${count} rows from ${filename}`);
		}
		await onRow(row); // properly waits for each row to finish processing

		// stop early if testing
		if (TEST_LIMIT && count >= TEST_LIMIT) {
			console.log(`  TEST_LIMIT reached — stopping at ${count} rows`);
			break;
		}
	}

	console.log(`  Finished ${filename} — ${count} total rows`);
};

// Inserts a batch of rows into a Sequelize model
// ignoreDuplicates means if a row already exists, skip it instead of crashing
const insertBatch = async (model, batch) => {
	if (batch.length === 0) return;
	await model.bulkCreate(batch, { ignoreDuplicates: true });
};

// ─── STEP 1: Load small files into memory ────────────────────────────────────

async function buildNutrientMap() {
	console.log("\n[1/4] Loading nutrient definitions...");

	// nutrient.csv columns: id, name, unit_name, nutrient_nbr, rank
	const rows = await loadCSV("nutrient.csv");

	const nutrientMap = new Map();
	for (const row of rows) {
		const id = parseInt(row.id);
		if (NUTRIENTS_TO_IMPORT.has(id)) {
			nutrientMap.set(id, {
				name: row.name,
				unit: row.unit_name,
			});
		}
	}

	console.log(`  Keeping ${nutrientMap.size} nutrients`);
	return nutrientMap;
}

async function buildPortionMap() {
	console.log("\n[2/4] Loading food portions...");

	// food_portion.csv columns: id, fdc_id, seq_num, amount, measure_unit_id,
	//                           portion_description, modifier, gram_weight, etc
	const rows = await loadCSV("food_portion.csv");

	const portionMap = new Map();
	for (const row of rows) {
		const fdcId = row.fdc_id;

		// only keep the first portion per food (seq_num = 1 is the primary serving)
		if (!portionMap.has(fdcId)) {
			const grams = toFloat(row.gram_weight);
			const label = row.portion_description || row.modifier || null;

			if (grams) {
				portionMap.set(fdcId, {
					serving_size_g: grams,
					serving_size_label: label,
				});
			}
		}
	}

	console.log(`  Built portion map with ${portionMap.size} entries`);
	return portionMap;
}

// ─── STEP 2: Stream food.csv and branded_food.csv together ───────────────────

async function importFoods(portionMap) {
	console.log("\n[3/4] Importing foods...");

	// First stream branded_food.csv to build a brand/barcode/serving lookup
	// branded_food.csv columns: fdc_id, brand_owner, brand_name, subbrand_name,
	//                           gtin_upc, ingredients, serving_size,
	//                           serving_size_unit, household_serving_fulltext, etc
	console.log("  Building branded food map...");
	const brandedMap = new Map();

	await streamCSV("branded_food.csv", (row) => {
		brandedMap.set(row.fdc_id, {
			brand: row.brand_owner || row.brand_name || null,
			barcode: row.gtin_upc || null,
			// branded foods store serving size differently
			// serving_size is the amount, serving_size_unit is the unit (g, ml etc)
			serving_size_g: row.serving_size_unit?.toLowerCase() === "g" ? toFloat(row.serving_size) : null,
			serving_size_label: row.household_serving_fulltext || null,
		});
	});

	console.log(`  Branded map has ${brandedMap.size} entries`);

	// Now stream food.csv and build food objects using branded + portion maps
	// food.csv columns: fdc_id, data_type, description, food_category_id,
	//                   publication_date
	console.log("  Streaming food.csv...");

	// fdcToIdMap stores { fdc_id → db uuid } after insert
	// needed in step 4 to link nutrients to foods
	const fdcToIdMap = new Map();

	let batch = [];
	let totalInserted = 0;
	let totalSkipped = 0;

	const flushBatch = async () => {
		if (batch.length === 0) return;

		// bulkCreate returns the inserted rows with their generated UUIDs
		const inserted = await food.bulkCreate(batch, {
			ignoreDuplicates: true,
			returning: true, // get back the rows with their db ids
		});

		// store fdc_id → db uuid mapping for use in step 4
		for (const food of inserted) {
			fdcToIdMap.set(String(food.fdc_id), food.id);
		}

		totalInserted += inserted.length;
		batch = [];
	};

	await streamCSV("food.csv", async (row) => {
		// skip food types we don't want
		if (!ALLOWED_DATA_TYPES.includes(row.data_type)) {
			totalSkipped++;
			return;
		}

		// look up brand/barcode/serving from branded map
		const branded = brandedMap.get(row.fdc_id);

		// fall back to portion map for serving info if not branded
		const portion = portionMap.get(row.fdc_id);

		batch.push({
			fdc_id: parseInt(row.fdc_id),
			name: row.description,
			brand: branded?.brand || null,
			barcode: branded?.barcode || null,
			serving_size_g: branded?.serving_size_g || portion?.serving_size_g || null,
			serving_size_label: branded?.serving_size_label || portion?.serving_size_label || null,
			source: "usda",
			submitted_by: null,
			is_deleted: false,
		});

		// flush batch every BATCH_SIZE rows
		if (batch.length >= BATCH_SIZE) {
			await flushBatch();
			console.log(`  Inserted ${totalInserted} foods so far...`);
		}
	});

	// flush any remaining rows
	await flushBatch();

	console.log(`  Done — inserted ${totalInserted} foods, skipped ${totalSkipped}`);
	return fdcToIdMap;
}

// ─── STEP 3: Stream food_nutrient.csv ────────────────────────────────────────

async function importNutrients(fdcToIdMap, nutrientMap) {
	console.log("\n[4/4] Importing nutrients...");
	console.log("  This will take a while — food_nutrient.csv is 1.7GB...");

	let batch = [];
	let totalInserted = 0;
	let totalSkipped = 0;

	const flushBatch = async () => {
		if (batch.length === 0) return;
		await insertBatch(foodNutrient, batch);
		totalInserted += batch.length;
		batch = [];
	};

	// food_nutrient.csv columns: id, fdc_id, nutrient_id, amount,
	//                            data_points, derivation_id, etc
	await streamCSV("food_nutrient.csv", async (row) => {
		const nutrientId = parseInt(row.nutrient_id);

		// skip nutrients we don't care about
		if (!NUTRIENTS_TO_IMPORT.has(nutrientId)) {
			totalSkipped++;
			return;
		}

		// skip if we didn't import this food (was a survey/lab food)
		const foodId = fdcToIdMap.get(row.fdc_id);
		if (!foodId) {
			totalSkipped++;
			return;
		}

		// look up nutrient name and unit
		const nutrient = nutrientMap.get(nutrientId);
		if (!nutrient) {
			totalSkipped++;
			return;
		}

		const amount = toFloat(row.amount);
		if (amount === null) {
			totalSkipped++;
			return;
		}

		batch.push({
			food_id: foodId,
			nutrient_id: nutrientId,
			nutrient_name: nutrient.name,
			unit: nutrient.unit,
			amount_per_100g: amount,
		});

		if (batch.length >= BATCH_SIZE) {
			await flushBatch();
			if (totalInserted % 100000 === 0) {
				console.log(`  Inserted ${totalInserted} nutrients so far...`);
			}
		}
	});

	await flushBatch();
	console.log(`  Done — inserted ${totalInserted} nutrients, skipped ${totalSkipped}`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
	console.log("=== USDA FoodData Central Import ===");
	const startTime = Date.now();

	try {
		await sequelize.authenticate();
		console.log("DB connection established");

		const nutrientMap = await buildNutrientMap();
		const portionMap = await buildPortionMap();
		const fdcToIdMap = await importFoods(portionMap);
		await importNutrients(fdcToIdMap, nutrientMap);

		const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
		console.log(`\n=== Import complete in ${elapsed} minutes ===`);
	} catch (err) {
		console.error("Import failed:", err);
		process.exit(1);
	} finally {
		await sequelize.close();
	}
}

main();
