const { DataError } = require("../error");

// ---------------------------------------------
// Thin wrapper around Gemini's generateContent REST endpoint — no SDK
// dependency, matching this backend's zero-HTTP-client-library convention.
// Structured output (response_mime_type + response_schema) constrains Gemini
// to return exactly the shape we need, minimizing manual parsing/validation.
// ---------------------------------------------

const GEMINI_TIMEOUT_MS = 20000;
const GEMINI_RETRY_DELAY_MS = 750;
const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_CAPTION_CHARS = 4000; // TikTok captions are short; this is just a defensive cap

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const RECIPE_RESPONSE_SCHEMA = {
	type: "OBJECT",
	properties: {
		is_recipe: { type: "BOOLEAN" },
		name: { type: "STRING" },
		servings: { type: "NUMBER" },
		ingredients: { type: "ARRAY", items: { type: "STRING" } },
		instructions: { type: "ARRAY", items: { type: "STRING" } },
	},
	required: ["is_recipe", "ingredients", "instructions"],
	propertyOrdering: ["is_recipe", "name", "servings", "ingredients", "instructions"],
};

function buildPrompt(captionText) {
	return `You are extracting a cooking recipe from a TikTok video's caption text. The caption may be messy, use emoji, hashtags, or informal shorthand, and often omits explicit step-by-step instructions.

Caption:
"""
${captionText}
"""

Decide whether this caption describes an actual food recipe — i.e. it names specific ingredients and/or steps for cooking or preparing a dish. Captions that are just hashtags, opinions, reactions, or unrelated content are NOT recipes.

Respond with JSON only, matching this shape:
- is_recipe: true only if you can confidently identify at least a partial ingredient list from the caption
- name: a short recipe title if one is apparent, otherwise omit
- servings: a number only if the caption explicitly states how many servings/people it makes, otherwise omit
- ingredients: an array of natural-language ingredient line strings, e.g. "2 lbs ground turkey", "1/2 cup chopped parsley" — include quantities/units exactly as stated when given, one ingredient per array entry. Do NOT return objects, only plain strings.
- instructions: an array of plain-text step strings in the order they should be performed. If the caption gives no explicit steps, return an empty array — do not invent steps.

If this is not a recipe, or you cannot find any ingredients, set is_recipe to false and return empty arrays for ingredients and instructions.`;
}

// One attempt at the POST, timing out after GEMINI_TIMEOUT_MS. Throws
// whatever fetchImpl throws (AbortError on timeout, or a network error) -
// caller decides whether that's worth retrying.
async function postToGemini(endpoint, body, apiKey, fetchImpl) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
	try {
		return await fetchImpl(endpoint, {
			method: "POST",
			signal: controller.signal,
			headers: {
				"Content-Type": "application/json",
				"x-goog-api-key": apiKey,
			},
			body: JSON.stringify(body),
		});
	} finally {
		clearTimeout(timer);
	}
}

async function callGemini(captionText, fetchImpl) {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		console.error("GEMINI_API_KEY is not set");
		throw new DataError("Couldn't process that TikTok video right now. Try again later.");
	}
	const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
	const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

	const body = {
		contents: [{ role: "user", parts: [{ text: buildPrompt(captionText.slice(0, MAX_CAPTION_CHARS)) }] }],
		generationConfig: {
			response_mime_type: "application/json",
			response_schema: RECIPE_RESPONSE_SCHEMA,
			temperature: 0.2,
			maxOutputTokens: 1024,
			thinkingConfig: { thinkingBudget: 0 }, //no thinking, task is trivial parsing
		},
	};

	// A stalled/timed-out request is usually a one-off (cold connection, a
	// brief local network hiccup) rather than a persistent failure, so one
	// quick retry clears most of them instead of failing the whole import.
	let res;
	try {
		res = await postToGemini(endpoint, body, apiKey, fetchImpl);
	} catch (err) {
		console.error("Gemini request failed, retrying once:", err);
		await sleep(GEMINI_RETRY_DELAY_MS);
		try {
			res = await postToGemini(endpoint, body, apiKey, fetchImpl);
		} catch (retryErr) {
			console.error("Gemini request failed again:", retryErr);
			throw new DataError("Couldn't process that TikTok video right now. Try again later.");
		}
	}

	if (!res.ok) {
		const errorBody = await res.text().catch(() => "(couldn't read body)");
		console.error(`Gemini returned HTTP ${res.status}:`, errorBody);
		throw new DataError("Couldn't process that TikTok video right now. Try again later.");
	}

	let payload;
	try {
		payload = await res.json();
	} catch {
		throw new DataError("Couldn't process that TikTok video right now. Try again later.");
	}

	const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
	if (!text) {
		console.error("Gemini response missing candidate text:", JSON.stringify(payload).slice(0, 500));
		throw new DataError("Couldn't process that TikTok video right now. Try again later.");
	}

	try {
		return JSON.parse(text);
	} catch {
		console.error("Gemini response was not valid JSON:", text.slice(0, 500));
		throw new DataError("Couldn't process that TikTok video right now. Try again later.");
	}
}

/**
 * `fetchImpl` injectable for tests; defaults to global fetch.
 * Throws DataError("Couldn't find a recipe in that TikTok video.") when
 * Gemini says it's not a recipe or found no ingredients — never leaks raw
 * Gemini/API error details to the caller.
 */
async function extractRecipeFromCaption(captionText, { fetchImpl = fetch } = {}) {
	if (!captionText || !captionText.trim()) {
		throw new DataError("Couldn't find a recipe in that TikTok video.");
	}

	const result = await callGemini(captionText, fetchImpl);

	const ingredients = Array.isArray(result.ingredients) ? result.ingredients.map((s) => String(s).trim()).filter(Boolean) : [];
	const instructions = Array.isArray(result.instructions) ? result.instructions.map((s) => String(s).trim()).filter(Boolean) : [];

	if (!result.is_recipe || ingredients.length === 0) {
		throw new DataError("Couldn't find a recipe in that TikTok video.");
	}

	return {
		name: typeof result.name === "string" && result.name.trim() ? result.name.trim() : null,
		servings: typeof result.servings === "number" && Number.isFinite(result.servings) && result.servings > 0 ? result.servings : null,
		ingredients,
		instructions,
	};
}

module.exports = {
	extractRecipeFromCaption,
	// exported for unit tests
	_internal: { buildPrompt, callGemini, RECIPE_RESPONSE_SCHEMA },
};
