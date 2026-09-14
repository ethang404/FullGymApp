const { isTikTokUrl, importTikTokRecipe } = require("../tiktokRecipeImport");

const oembedOkResponse = (body) => ({
	ok: true,
	status: 200,
	json: async () => body,
});

const geminiOkResponse = (jsonPayload) => ({
	ok: true,
	status: 200,
	json: async () => ({
		candidates: [{ content: { parts: [{ text: JSON.stringify(jsonPayload) }] } }],
	}),
});

describe("isTikTokUrl", () => {
	test.each([
		"https://www.tiktok.com/@user/video/123",
		"https://vm.tiktok.com/ZMabc123/",
		"https://m.tiktok.com/@user/video/123",
		"https://tiktok.com/@user/video/123",
		"https://vt.tiktok.com/ZMabc123/",
	])("true for %s", (url) => {
		expect(isTikTokUrl(url)).toBe(true);
	});

	test.each(["https://example.com/recipe", "https://nottiktok.com/@user/video/123", "not a url"])("false for %s", (url) => {
		expect(isTikTokUrl(url)).toBe(false);
	});
});

describe("importTikTokRecipe", () => {
	const ORIGINAL_ENV = process.env;
	const TIKTOK_URL = "https://www.tiktok.com/@chef/video/7312508978880154888";

	beforeEach(() => {
		process.env = { ...ORIGINAL_ENV, GEMINI_API_KEY: "test-key" };
	});

	afterAll(() => {
		process.env = ORIGINAL_ENV;
	});

	function mockFetch({ oembed, gemini }) {
		return jest.fn(async (url) => {
			const href = String(url);
			if (href.includes("tiktok.com/oembed")) return oembed;
			if (href.includes("generativelanguage.googleapis.com")) return gemini;
			throw new Error(`unexpected fetch to ${href}`);
		});
	}

	test("successful end-to-end path assembles the ImportedRecipe shape", async () => {
		const fetchImpl = mockFetch({
			oembed: oembedOkResponse({
				title: "Turkey meatballs! 2 lbs ground turkey, garlic powder to taste",
				author_name: "chef",
				thumbnail_url: "https://p16-sign.tiktokcdn.com/thumb.jpg",
			}),
			gemini: geminiOkResponse({
				is_recipe: true,
				name: "Turkey Meatballs",
				servings: 4,
				ingredients: ["2 lbs ground turkey", "garlic powder to taste"],
				instructions: [],
			}),
		});

		const recipe = await importTikTokRecipe(TIKTOK_URL, { fetchImpl });

		expect(recipe).toEqual({
			source_url: TIKTOK_URL,
			name: "Turkey Meatballs",
			description: null,
			author: "chef",
			image: "https://p16-sign.tiktokcdn.com/thumb.jpg",
			servings: 4,
			recipe_yield: [],
			prep_time_minutes: null,
			cook_time_minutes: null,
			total_time_minutes: null,
			ingredients: ["2 lbs ground turkey", "garlic powder to taste"],
			instructions: [],
			nutrition: null,
			keywords: [],
			categories: [],
			cuisines: [],
		});
	});

	test("oembed 404 (private/deleted video) never calls Gemini", async () => {
		const gemini = jest.fn();
		const fetchImpl = jest.fn(async (url) => {
			if (String(url).includes("tiktok.com/oembed")) return { ok: false, status: 404 };
			gemini();
			throw new Error("should not reach Gemini");
		});

		await expect(importTikTokRecipe(TIKTOK_URL, { fetchImpl })).rejects.toThrow(/private or deleted/i);
		expect(gemini).not.toHaveBeenCalled();
	});

	test("oembed returns blank title", async () => {
		const fetchImpl = jest.fn(async () => oembedOkResponse({ title: "", author_name: "chef" }));
		await expect(importTikTokRecipe(TIKTOK_URL, { fetchImpl })).rejects.toThrow(/doesn't have a caption/i);
	});

	test("Gemini says not a recipe", async () => {
		const fetchImpl = mockFetch({
			oembed: oembedOkResponse({ title: "just vibing #fyp", author_name: "chef", thumbnail_url: "https://x.jpg" }),
			gemini: geminiOkResponse({ is_recipe: false, ingredients: [], instructions: [] }),
		});

		await expect(importTikTokRecipe(TIKTOK_URL, { fetchImpl })).rejects.toThrow(/couldn't find a recipe/i);
	});

	test("oembed timeout maps to a friendly message", async () => {
		const fetchImpl = jest.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
		await expect(importTikTokRecipe(TIKTOK_URL, { fetchImpl })).rejects.toThrow(/too long/i);
	});
});
