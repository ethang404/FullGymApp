const { DataError } = require("../error");

// ---------------------------------------------
// Recipe import — fetch a recipe web page, pull the schema.org
// <script type="application/ld+json"> block out of it, and normalize the
// Recipe node into flat arrays the caller can match against our food DB.
//
// Nothing here touches the database. parseRecipeFromHtml is pure so it can be
// unit-tested against saved fixtures; importRecipeFromUrl adds the network I/O.
// ---------------------------------------------

const FETCH_TIMEOUT_MS = 10000;
const MAX_HTML_BYTES = 8 * 1024 * 1024; // recipe blogs are big, but not this big

// ---------------------------------------------
// URL / SSRF guard — this endpoint fetches a user-supplied URL server-side, so
// keep it to public http(s) hosts and reject anything pointing back at our own
// network. Hostname-pattern matching only (no DNS rebinding protection), which
// is enough for a personal app.
// ---------------------------------------------
const BLOCKED_HOST_PATTERNS = [
	/^localhost$/i,
	/\.local$/i,
	/^127\./,
	/^10\./,
	/^192\.168\./,
	/^169\.254\./, // link-local / cloud metadata
	/^172\.(1[6-9]|2\d|3[01])\./,
	/^0\./,
	/^::1$/,
	/^fc00:/i,
	/^fd[0-9a-f]{2}:/i,
	/^fe80:/i,
];

function assertSafeUrl(raw) {
	let url;
	try {
		url = new URL(raw);
	} catch {
		throw new DataError("That doesn't look like a valid URL");
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new DataError("Recipe URL must start with http:// or https://");
	}

	const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
	if (host === "0.0.0.0" || BLOCKED_HOST_PATTERNS.some((re) => re.test(host))) {
		throw new DataError("That URL host isn't allowed");
	}

	return url;
}

// ---------------------------------------------
// Text helpers
// ---------------------------------------------
const NAMED_ENTITIES = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	deg: "°",
	frac12: "½",
	frac13: "⅓",
	frac14: "¼",
	frac23: "⅔",
	frac34: "¾",
	hellip: "…",
	mdash: "—",
	ndash: "–",
	rsquo: "’",
	lsquo: "‘",
	rdquo: "”",
	ldquo: "“",
};

//These are all used to simplify the html to find the script object
function fromCodePoint(cp) {
	try {
		return String.fromCodePoint(cp);
	} catch {
		return "";
	}
}

function decodeEntities(str) {
	if (str == null) return "";
	return String(str)
		.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => fromCodePoint(parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_, d) => fromCodePoint(parseInt(d, 10)))
		.replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => (name in NAMED_ENTITIES ? NAMED_ENTITIES[name] : m));
}

// Recipe fields (esp. instructions) sometimes carry inline HTML — flatten to
// plain text, decode entities, collapse whitespace.
function cleanText(value) {
	if (value == null) return "";
	return decodeEntities(String(value).replace(/<[^>]*>/g, " "))
		.replace(/\s+/g, " ")
		.trim();
}

// ---------------------------------------------
// JSON-LD extraction
// ---------------------------------------------
function extractJsonLdBlocks(html) {
	const blocks = [];
	const re = /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

	let match;
	while ((match = re.exec(html)) !== null) {
		let raw = match[1].trim();
		if (!raw) continue;

		// Strip CDATA / HTML-comment wrappers some CMSes add
		raw = raw
			.replace(/^<!--/, "")
			.replace(/-->$/, "")
			.replace(/^\/\/<!\[CDATA\[/, "")
			.replace(/\/\/\]\]>$/, "")
			.replace(/^<!\[CDATA\[/, "")
			.replace(/\]\]>$/, "")
			.trim();

		try {
			blocks.push(JSON.parse(raw));
		} catch {
			/* skip blocks we can't parse rather than failing the whole import */
		}
	}

	return blocks;
}

function typeList(node) {
	const t = node && node["@type"];
	if (!t) return [];
	return (Array.isArray(t) ? t : [t]).map((x) => String(x).toLowerCase());
}

// Walk the parsed JSON-LD (object, array, or {"@graph":[...]}) looking for the
// first node typed as a @Recipe.

//Each node has @type, and might have inner @graph: [].
//top level might look like:
//{ "@context": "...", "@graph": [ Article, WebPage, ImageObject, BreadcrumbList,
// WebSite, Organization, Person, Recipe ] }

//We also check each node's inner graph: [] to see if Recipe exists nested in there

//so Recipe might look like:
//{
//  "@type": "Recipe",
//  "name": "Homemade Tzatziki Sauce Recipe",

function findRecipeNode(parsed) {
	const stack = Array.isArray(parsed) ? [...parsed] : [parsed];
	const seen = new Set();

	while (stack.length) {
		const node = stack.shift();
		if (!node || typeof node !== "object" || seen.has(node)) continue;
		seen.add(node);

		if (typeList(node).includes("recipe")) return node;

		if (Array.isArray(node["@graph"])) stack.push(...node["@graph"]);
		if (Array.isArray(node.itemListElement)) stack.push(...node.itemListElement);
		if (node.mainEntity && typeof node.mainEntity === "object") stack.push(node.mainEntity);
	}

	return null;
}

// ---------------------------------------------
// Field normalizers
// ---------------------------------------------

// ISO-8601 duration ("PT250M", "PT1H10M", "P1DT2H") -> whole minutes
function parseDurationToMinutes(iso) {
	if (!iso || typeof iso !== "string") return null;
	const m = iso.trim().match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
	if (!m) return null;

	const [, w, d, h, min, s] = m;
	const total =
		parseInt(w || 0, 10) * 10080 + parseInt(d || 0, 10) * 1440 + parseInt(h || 0, 10) * 60 + parseInt(min || 0, 10) + Math.round(parseFloat(s || 0) / 60);

	return total > 0 ? total : null;
}

// recipeYield can be a number, "4 servings", or ["24", "24 meatballs"].
// Pull the first sensible integer/decimal out.
function parseServings(recipeYield) {
	if (recipeYield == null) return null;
	const candidates = Array.isArray(recipeYield) ? recipeYield : [recipeYield];

	for (const c of candidates) {
		if (typeof c === "number" && Number.isFinite(c)) return c;
		const m = String(c).match(/\d+(?:\.\d+)?/);
		if (m) return parseFloat(m[0]);
	}
	return null;
}

function toStringArray(value) {
	if (value == null) return [];
	const arr = Array.isArray(value) ? value : [value];
	return arr.map((v) => cleanText(typeof v === "object" && v ? v.name || v.text || "" : v)).filter(Boolean);
}

// recipeInstructions: array of strings, HowToStep objects, or HowToSection
// objects that nest their own itemListElement steps.
function flattenInstructions(value) {
	if (value == null) return [];
	const arr = Array.isArray(value) ? value : [value];
	const out = [];

	for (const step of arr) {
		if (step == null) continue;

		if (typeof step === "string") {
			const s = cleanText(step);
			if (s) out.push(s);
			continue;
		}

		if (typeof step === "object") {
			if (typeList(step).includes("howtosection") || Array.isArray(step.itemListElement)) {
				out.push(...flattenInstructions(step.itemListElement));
				continue;
			}
			const s = cleanText(step.text || step.name || "");
			if (s) out.push(s);
		}
	}

	return out;
}

function firstImageUrl(image) {
	if (!image) return null;
	if (typeof image === "string") return image;
	if (Array.isArray(image)) {
		for (const entry of image) {
			const url = firstImageUrl(entry);
			if (url) return url;
		}
		return null;
	}
	if (typeof image === "object") return image.url || image.contentUrl || null;
	return null;
}

function authorName(author) {
	if (!author) return null;
	if (typeof author === "string") return cleanText(author);
	if (Array.isArray(author)) return authorName(author[0]);
	if (typeof author === "object") return author.name ? cleanText(author.name) : null;
	return null;
}

function parseNutrition(n) {
	if (!n || typeof n !== "object") return null;

	const num = (v) => {
		if (v == null) return null;
		const m = String(v).match(/-?\d+(?:\.\d+)?/);
		return m ? parseFloat(m[0]) : null;
	};

	const out = {
		calories: num(n.calories),
		protein_g: num(n.proteinContent),
		carbs_g: num(n.carbohydrateContent),
		fat_g: num(n.fatContent),
		saturated_fat_g: num(n.saturatedFatContent),
		fiber_g: num(n.fiberContent),
		sugar_g: num(n.sugarContent),
		sodium_mg: num(n.sodiumContent),
		cholesterol_mg: num(n.cholesterolContent),
		serving_size: n.servingSize ? cleanText(n.servingSize) : null,
	};

	return Object.values(out).some((v) => v != null && v !== "") ? out : null;
}

function parseKeywords(keywords) {
	if (!keywords) return [];
	if (Array.isArray(keywords)) return keywords.map((k) => cleanText(k)).filter(Boolean);
	return String(keywords)
		.split(",")
		.map((k) => cleanText(k))
		.filter(Boolean);
}

function normalizeRecipe(node, sourceUrl) {
	const rawIngredients = node.recipeIngredient && node.recipeIngredient.length ? node.recipeIngredient : node.ingredients;

	return {
		source_url: sourceUrl,
		name: cleanText(node.name) || null,
		description: cleanText(node.description) || null,
		author: authorName(node.author),
		image: firstImageUrl(node.image),

		servings: parseServings(node.recipeYield),
		recipe_yield: toStringArray(node.recipeYield),

		prep_time_minutes: parseDurationToMinutes(node.prepTime),
		cook_time_minutes: parseDurationToMinutes(node.cookTime),
		total_time_minutes: parseDurationToMinutes(node.totalTime),

		ingredients: toStringArray(rawIngredients),
		instructions: flattenInstructions(node.recipeInstructions),

		nutrition: parseNutrition(node.nutrition),

		keywords: parseKeywords(node.keywords),
		categories: toStringArray(node.recipeCategory),
		cuisines: toStringArray(node.recipeCuisine),
	};
}

// ---------------------------------------------
// Public API
// ---------------------------------------------

/**
 * Pure: given page HTML, extract + normalize the first schema.org Recipe.
 * Throws DataError with a user-facing message when there's nothing usable.
 */
function parseRecipeFromHtml(html, sourceUrl) {
	if (!html || typeof html !== "string") throw new DataError("That page had no content to read");

	const blocks = extractJsonLdBlocks(html);
	if (blocks.length === 0) {
		throw new DataError("Couldn't find structured recipe data on that page. It may not be a supported recipe site.");
	}

	let recipeNode = null;
	for (const block of blocks) {
		recipeNode = findRecipeNode(block);
		if (recipeNode) break;
	}
	if (!recipeNode) {
		throw new DataError("That page has structured data, but no recipe in it.");
	}

	const recipe = normalizeRecipe(recipeNode, sourceUrl);

	if (recipe.ingredients.length === 0) {
		throw new DataError("Found a recipe but couldn't read any ingredients from it.");
	}

	return recipe;
}

/**
 * Fetch `rawUrl` and hand the HTML to parseRecipeFromHtml.
 * `fetchImpl` is injectable for tests; defaults to the global fetch (Node 18+).
 */
async function importRecipeFromUrl(rawUrl, { fetchImpl = fetch } = {}) {
	if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
		throw new DataError("A recipe URL is required");
	}

	const url = assertSafeUrl(rawUrl.trim());

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

	let res;
	try {
		res = await fetchImpl(url.href, {
			signal: controller.signal,
			redirect: "follow",
			headers: {
				"User-Agent": "Mozilla/5.0 (compatible; FullGymApp/1.0; recipe importer)",
				Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			},
		});
	} catch (err) {
		if (err.name === "AbortError") throw new DataError("That site took too long to respond");
		throw new DataError("Couldn't reach that URL");
	} finally {
		clearTimeout(timer);
	}

	if (!res.ok) throw new DataError(`That site returned an error (HTTP ${res.status})`);

	const contentType = res.headers.get("content-type") || "";
	if (contentType && !/(html|xml|text)/i.test(contentType)) {
		throw new DataError("That URL doesn't point to a web page");
	}

	const html = await res.text();
	if (html.length > MAX_HTML_BYTES) {
		throw new DataError("That page is too large to import");
	}

	return parseRecipeFromHtml(html, url.href);
}

module.exports = {
	importRecipeFromUrl,
	parseRecipeFromHtml,
	// exported for unit tests
	_internal: {
		assertSafeUrl,
		decodeEntities,
		cleanText,
		extractJsonLdBlocks,
		findRecipeNode,
		parseDurationToMinutes,
		parseServings,
		flattenInstructions,
		parseNutrition,
		normalizeRecipe,
	},
};
