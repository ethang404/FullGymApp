const { DataError } = require("../error");
const { extractRecipeFromCaption } = require("./geminiRecipeParser");

// ---------------------------------------------
// TikTok recipe import — v1 is caption-only: no transcript/subtitle scraping.
// We hit TikTok's public oembed endpoint for title (=caption) + author +
// thumbnail, then hand the caption text to Gemini to extract ingredients/
// instructions. Output is assembled into the same ImportedRecipe shape that
// normalizeRecipe() in recipeImport.js produces, so callers can't tell the
// difference.
// ---------------------------------------------

const OEMBED_TIMEOUT_MS = 10000;

// Matches www.tiktok.com, m.tiktok.com, vm.tiktok.com, vt.tiktok.com, and bare
// tiktok.com — covers full video URLs and both short-link domains TikTok uses.
const TIKTOK_HOST_RE = /^(?:www\.|m\.|vm\.|vt\.)?tiktok\.com$/i;

function isTikTokUrl(urlOrString) {
	try {
		const url = typeof urlOrString === "string" ? new URL(urlOrString) : urlOrString;
		return TIKTOK_HOST_RE.test(url.hostname.toLowerCase());
	} catch {
		return false;
	}
}

async function fetchOembed(rawUrl, fetchImpl) {
	const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(rawUrl)}`;

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), OEMBED_TIMEOUT_MS);

	let res;
	try {
		res = await fetchImpl(oembedUrl, {
			signal: controller.signal,
			redirect: "follow",
			headers: {
				"User-Agent": "Mozilla/5.0 (compatible; FullGymApp/1.0; recipe importer)",
				Accept: "application/json",
			},
		});
	} catch (err) {
		if (err.name === "AbortError") throw new DataError("TikTok took too long to respond");
		throw new DataError("Couldn't reach TikTok");
	} finally {
		clearTimeout(timer);
	}

	// TikTok's oembed returns 404 for private/deleted/invalid videos, 400 for
	// malformed urls — both map to the same friendly message.
	if (!res.ok) {
		throw new DataError("Couldn't find that TikTok video. It may be private or deleted.");
	}

	let data;
	try {
		data = await res.json();
	} catch {
		throw new DataError("Couldn't read that TikTok video's details");
	}

	if (!data || typeof data.title !== "string" || !data.title.trim()) {
		throw new DataError("That TikTok video doesn't have a caption to read a recipe from");
	}

	return data; // { title, author_name, thumbnail_url, ... }
}

/**
 * `fetchImpl` is injectable for tests; defaults to global fetch (Node 18+).
 * Same fetchImpl is threaded into geminiRecipeParser so tests only need to
 * mock one function, keyed off request URL.
 */
async function importTikTokRecipe(rawUrl, { fetchImpl = fetch } = {}) {
	const oembed = await fetchOembed(rawUrl, fetchImpl);

	const parsed = await extractRecipeFromCaption(oembed.title, { fetchImpl });

	return {
		source_url: rawUrl,
		name: parsed.name,
		description: null,
		author: oembed.author_name || null,
		image: oembed.thumbnail_url || null,

		servings: parsed.servings,
		recipe_yield: [],

		prep_time_minutes: null,
		cook_time_minutes: null,
		total_time_minutes: null,

		ingredients: parsed.ingredients,
		instructions: parsed.instructions,

		nutrition: null,

		keywords: [],
		categories: [],
		cuisines: [],
	};
}

module.exports = {
	isTikTokUrl,
	importTikTokRecipe,
	// exported for unit tests
	_internal: { fetchOembed, TIKTOK_HOST_RE },
};
