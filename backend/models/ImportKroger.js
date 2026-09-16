/**
 * Kroger Product API Import Script
 *
 * Imports foods, nutrients, and serving sizes from the Kroger Product API
 * (developer.kroger.com) into your database. Matches the same schema as the
 * USDA / Open Food Facts imports.
 *
 * Requires:
 *   - KROGER_CLIENT_ID / KROGER_CLIENT_SECRET in ../.env (client-credentials app)
 *
 * No store location is used — searches run location-independent, so
 * `items[]` (price/inventory) comes back empty, but `nutritionInformation`
 * (what we actually care about) is a static product attribute and is
 * unaffected.
 *
 * Usage:
 *   node ImportKroger.js
 */

require("dotenv").config({ path: "../.env" });
console.log("DB URL:", process.env.DB_CONNECTION_URL);

const { Op } = require("sequelize");
const { food, foodNutrient, foodServingSize } = require("./modelInits");
const sequelize = require("./db");
const { findDensityForFood } = require("../Nutrition/unitConversion");

// ─── CONFIG ──────────────────────────────────────────────────────────────────

// Search terms used to discover products. Extend this list to widen the catalog.
const SEARCH_TERMS = [
	"milk",
	"eggs",
	"chicken breast",
	"bread",
	"rice",
	"pasta",
	"cheese",
	"yogurt",
	"ground beef",
	"apples",
	"bananas",
	"broccoli",
	"peanut butter",
	"cereal",
	"orange juice",
];

const KROGER_BASE_URL = "https://api.kroger.com/v1";
const PAGE_LIMIT = 50; // Kroger's max page size
const MAX_PRODUCTS_PER_TERM = null; // set a number for testing, null = no cap
const REQUEST_DELAY_MS = 250; // delay between Kroger calls to stay under rate limits
const BATCH_SIZE = 1000;

const KROGER_TIMEOUT_MS = 20000;
const KROGER_RETRY_DELAY_MS = 750;

// ─── NUTRIENT CODE MAP ────────────────────────────────────────────────────────

// Maps Kroger's nutrient `code` (INFOODS/LanguaL-style tags) -> our nutrient_id.
// Best-effort guess based on the one confirmed sample field (CA = calcium) —
// NOT verified against a full real response. Any code seen at runtime that
// isn't in this map gets logged (deduped) at the end of the import so it can
// be added here later instead of silently dropping data.
const KROGER_NUTRIENT_MAP = {
	ENERC_KCAL: { nutrientId: 1008, name: "Energy", unit: "KCAL" },
	PROCNT: { nutrientId: 1003, name: "Protein", unit: "G" },
	FAT: { nutrientId: 1004, name: "Total lipid (fat)", unit: "G" },
	CHOCDF: { nutrientId: 1005, name: "Carbohydrate, by difference", unit: "G" },
	FIBTG: { nutrientId: 1079, name: "Fiber, total dietary", unit: "G" },
	SUGAR: { nutrientId: 2000, name: "Total Sugars", unit: "G" },
	FASAT: { nutrientId: 1258, name: "Fatty acids, total saturated", unit: "G" },
	FATRN: { nutrientId: 1257, name: "Fatty acids, total trans", unit: "G" },
	CHOLE: { nutrientId: 1253, name: "Cholesterol", unit: "MG" },
	NA: { nutrientId: 1093, name: "Sodium, Na", unit: "MG" },
	K: { nutrientId: 1092, name: "Potassium, K", unit: "MG" },
	CA: { nutrientId: 1087, name: "Calcium, Ca", unit: "MG" },
	FE: { nutrientId: 1089, name: "Iron, Fe", unit: "MG" },
};

const unmappedNutrientCodes = new Set();

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// One attempt at a fetch, timing out after KROGER_TIMEOUT_MS.
async function fetchWithTimeout(url, options, fetchImpl) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), KROGER_TIMEOUT_MS);
	try {
		return await fetchImpl(url, { ...options, signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
}

// A stalled/timed-out request is usually a one-off (cold connection, a brief
// local network hiccup) rather than a persistent failure, so one quick retry
// clears most of them instead of failing the whole import.
async function fetchWithRetry(url, options, fetchImpl = fetch) {
	try {
		return await fetchWithTimeout(url, options, fetchImpl);
	} catch (err) {
		console.error(`Request failed, retrying once: ${url}`, err.message);
		await sleep(KROGER_RETRY_DELAY_MS);
		return await fetchWithTimeout(url, options, fetchImpl);
	}
}

// ─── OAUTH2 CLIENT CREDENTIALS ─────────────────────────────────────────────────

let cachedToken = null; // { token, expiresAt }

async function getAccessToken() {
	if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
		return cachedToken.token;
	}

	const clientId = process.env.KROGER_CLIENT_ID;
	const clientSecret = process.env.KROGER_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw new Error("KROGER_CLIENT_ID / KROGER_CLIENT_SECRET are not set in .env");
	}

	const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
	const res = await fetchWithRetry(`${KROGER_BASE_URL}/connect/oauth2/token`, {
		method: "POST",
		headers: {
			Authorization: `Basic ${basicAuth}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: "grant_type=client_credentials&scope=product.compact",
	});

	if (!res.ok) {
		const body = await res.text().catch(() => "(couldn't read body)");
		throw new Error(`Kroger token request failed: HTTP ${res.status} - ${body}`);
	}

	const payload = await res.json();
	if (!payload.access_token) {
		throw new Error(`Kroger token response missing access_token: ${JSON.stringify(payload).slice(0, 300)}`);
	}

	cachedToken = {
		token: payload.access_token,
		expiresAt: Date.now() + payload.expires_in * 1000,
	};
	return cachedToken.token;
}

async function krogerGet(path) {
	const token = await getAccessToken();
	const res = await fetchWithRetry(`${KROGER_BASE_URL}${path}`, {
		headers: { Authorization: `Bearer ${token}` },
	});

	if (!res.ok) {
		const body = await res.text().catch(() => "(couldn't read body)");
		throw new Error(`Kroger request failed: HTTP ${res.status} - ${body} (${path})`);
	}

	return res.json();
}

// ─── SERVING SIZE / NUTRIENT NORMALIZATION ─────────────────────────────────────

// Resolves a Kroger servingSize {quantity, unitOfMeasure} to grams.
// Returns null if the unit can't be resolved to grams.
function resolveServingGrams(servingSize, foodName, brand) {
	if (!servingSize || !servingSize.quantity || !servingSize.unitOfMeasure) return null;

	const abbreviation = (servingSize.unitOfMeasure.abbreviation || "").toLowerCase();
	const quantity = Number(servingSize.quantity);
	if (!Number.isFinite(quantity) || quantity <= 0) return null;

	if (abbreviation === "g") return quantity;
	if (abbreviation === "kg") return quantity * 1000;

	if (abbreviation === "ml" || abbreviation === "l") {
		const ml = abbreviation === "l" ? quantity * 1000 : quantity;
		const gPerMl = findDensityForFood(foodName, brand);
		return gPerMl != null ? ml * gPerMl : null;
	}

	// Unrecognized unit (e.g. oz, count) — can't resolve to grams
	return null;
}

// Converts Kroger's per-serving nutrient quantities to per-100g, tracking
// unmapped codes as it goes. Returns [] if nothing could be mapped.
function normalizeNutrients(nutrients, servingGrams) {
	if (!Array.isArray(nutrients) || !servingGrams) return [];

	const rows = [];
	for (const nutrient of nutrients) {
		const mapping = KROGER_NUTRIENT_MAP[nutrient.code];
		if (!mapping) {
			unmappedNutrientCodes.add(`${nutrient.code} (${nutrient.description || nutrient.displayName || "?"})`);
			continue;
		}

		const quantity = Number(nutrient.quantity);
		if (!Number.isFinite(quantity)) continue;

		rows.push({
			nutrient_id: mapping.nutrientId,
			nutrient_name: mapping.name,
			unit: mapping.unit,
			amount_per_100g: quantity * (100 / servingGrams),
		});
	}
	return rows;
}

// ─── PRODUCT -> DB ROW MAPPING ─────────────────────────────────────────────────

function buildRowsForProduct(product, stats) {
	const upc = product.upc;
	if (!upc) {
		stats.skippedNoUpc++;
		return null;
	}

	const nutritionInfo = product.nutritionInformation;
	if (!nutritionInfo || !Array.isArray(nutritionInfo.nutrients) || nutritionInfo.nutrients.length === 0) {
		stats.skippedNoNutrition++;
		return null;
	}

	const name = product.description;
	const brand = product.brand || null;

	const servingGrams = resolveServingGrams(nutritionInfo.servingSize, name, brand);
	if (!servingGrams) {
		stats.skippedNoServingGrams++;
		return null;
	}

	const nutrientRows = normalizeNutrients(nutritionInfo.nutrients, servingGrams);
	if (nutrientRows.length === 0) {
		stats.skippedNoMappedNutrients++;
		return null;
	}

	return {
		foodRow: {
			name,
			brand,
			barcode: upc,
			source: "kroger",
			submitted_by: null,
			is_deleted: false,
		},
		nutrientRows,
		servingSizeRow: {
			label: nutritionInfo.servingSize.description || "serving",
			weight_g: servingGrams,
		},
	};
}

// ─── KROGER PRODUCT SEARCH ─────────────────────────────────────────────────────

// Whether a list-response product already carries usable nutrition data, or
// needs a follow-up detail fetch to get nutritionInformation.
function hasNutritionData(product) {
	return Boolean(product.nutritionInformation && Array.isArray(product.nutritionInformation.nutrients) && product.nutritionInformation.nutrients.length > 0);
}

async function* searchProducts(term, stats) {
	let start = 0;
	let fetched = 0;

	while (true) {
		const remaining = MAX_PRODUCTS_PER_TERM ? MAX_PRODUCTS_PER_TERM - fetched : PAGE_LIMIT;
		if (remaining <= 0) return;
		const limit = Math.min(PAGE_LIMIT, remaining);

		const query = new URLSearchParams({
			"filter.term": term,
			"filter.limit": String(limit),
			"filter.start": String(start),
		});

		await sleep(REQUEST_DELAY_MS);
		const page = await krogerGet(`/products?${query.toString()}`);
		const products = page.data || [];
		if (products.length === 0) return;

		for (let product of products) {
			if (!hasNutritionData(product)) {
				await sleep(REQUEST_DELAY_MS);
				try {
					const detail = await krogerGet(`/products/${product.productId}`);
					product = detail.data || product;
				} catch (err) {
					console.error(`  Detail fetch failed for ${product.productId}:`, err.message);
					stats.skippedDetailFetchFailed++;
					continue;
				}
			}
			yield product;
		}

		fetched += products.length;
		start += products.length;
		if (products.length < limit) return; // last page
	}
}

// ─── MAIN IMPORT ─────────────────────────────────────────────────────────────

async function importKroger() {
	console.log("\n=== Kroger Product Import ===\n");

	const existingBarcodes = new Set(
		(await food.findAll({ attributes: ["barcode"], where: { barcode: { [Op.ne]: null } }, raw: true })).map((f) => f.barcode),
	);
	console.log(`Loaded ${existingBarcodes.size} existing barcodes for dedup.`);

	const stats = {
		found: 0,
		inserted: 0,
		nutrientsInserted: 0,
		skippedDuplicate: 0,
		skippedNoUpc: 0,
		skippedNoNutrition: 0,
		skippedNoServingGrams: 0,
		skippedNoMappedNutrients: 0,
		skippedDetailFetchFailed: 0,
	};

	let batch = [];

	for (const term of SEARCH_TERMS) {
		console.log(`\nSearching: "${term}"`);
		let termCount = 0;

		for await (const product of searchProducts(term, stats)) {
			stats.found++;

			if (product.upc && existingBarcodes.has(product.upc)) {
				stats.skippedDuplicate++;
				continue;
			}

			const built = buildRowsForProduct(product, stats);
			if (!built) continue;

			existingBarcodes.add(built.foodRow.barcode); // dedupe within this run too
			batch.push(built);
			termCount++;

			if (batch.length >= BATCH_SIZE) {
				const result = await flushBatch(batch);
				stats.inserted += result.foods;
				stats.nutrientsInserted += result.nutrients;
				batch = [];
			}
		}

		console.log(`  -> ${termCount} new products queued from "${term}"`);
	}

	if (batch.length > 0) {
		const result = await flushBatch(batch);
		stats.inserted += result.foods;
		stats.nutrientsInserted += result.nutrients;
	}

	console.log("\n=== Done ===");
	console.log(`  Products found:          ${stats.found}`);
	console.log(`  Foods inserted:          ${stats.inserted}`);
	console.log(`  Nutrients inserted:      ${stats.nutrientsInserted}`);
	console.log(`  Skipped (duplicate):     ${stats.skippedDuplicate}`);
	console.log(`  Skipped (no UPC):        ${stats.skippedNoUpc}`);
	console.log(`  Skipped (no nutrition):  ${stats.skippedNoNutrition}`);
	console.log(`  Skipped (no serving g):  ${stats.skippedNoServingGrams}`);
	console.log(`  Skipped (no mapped nutrients): ${stats.skippedNoMappedNutrients}`);
	console.log(`  Skipped (detail fetch failed): ${stats.skippedDetailFetchFailed}`);

	if (unmappedNutrientCodes.size > 0) {
		console.log("\n  Unmapped nutrient codes seen (add these to KROGER_NUTRIENT_MAP):");
		for (const code of unmappedNutrientCodes) console.log(`    - ${code}`);
	}
}

// ─── BATCH INSERT ─────────────────────────────────────────────────────────────

async function flushBatch(batch) {
	const foodRows = batch.map((b) => b.foodRow);

	const inserted = await food.bulkCreate(foodRows, { returning: true });

	const insertedMap = new Map();
	for (const f of inserted) insertedMap.set(f.barcode, f.id);

	const nutrientRows = [];
	const servingSizeRows = [];
	for (const { foodRow, nutrientRows: rowNutrients, servingSizeRow } of batch) {
		const foodId = insertedMap.get(foodRow.barcode);
		if (!foodId) continue;

		for (const nutrient of rowNutrients) {
			nutrientRows.push({ food_id: foodId, ...nutrient });
		}
		servingSizeRows.push({ food_id: foodId, ...servingSizeRow });
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

		await importKroger();

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
