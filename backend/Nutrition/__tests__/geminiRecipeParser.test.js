const { extractRecipeFromCaption } = require("../geminiRecipeParser");

const geminiOkResponse = (jsonPayload) => ({
	ok: true,
	status: 200,
	json: async () => ({
		candidates: [{ content: { parts: [{ text: JSON.stringify(jsonPayload) }] } }],
	}),
});

describe("extractRecipeFromCaption", () => {
	const ORIGINAL_ENV = process.env;

	beforeEach(() => {
		process.env = { ...ORIGINAL_ENV, GEMINI_API_KEY: "test-key" };
	});

	afterAll(() => {
		process.env = ORIGINAL_ENV;
	});

	test("successful extraction returns name/servings/ingredients/instructions", async () => {
		const fetchImpl = jest.fn().mockResolvedValue(
			geminiOkResponse({
				is_recipe: true,
				name: "Turkey Meatballs",
				servings: 4,
				ingredients: ["2 lbs ground turkey", "1 tbsp garlic powder"],
				instructions: ["Mix everything", "Cook for 20 minutes"],
			})
		);

		const result = await extractRecipeFromCaption("Turkey meatballs recipe 2 lbs ground turkey...", { fetchImpl });

		expect(result).toEqual({
			name: "Turkey Meatballs",
			servings: 4,
			ingredients: ["2 lbs ground turkey", "1 tbsp garlic powder"],
			instructions: ["Mix everything", "Cook for 20 minutes"],
		});
	});

	test("Gemini says not a recipe", async () => {
		const fetchImpl = jest.fn().mockResolvedValue(geminiOkResponse({ is_recipe: false, ingredients: [], instructions: [] }));
		await expect(extractRecipeFromCaption("just a dance video #fyp", { fetchImpl })).rejects.toThrow(/couldn't find a recipe/i);
	});

	test("is_recipe true but no ingredients found", async () => {
		const fetchImpl = jest.fn().mockResolvedValue(geminiOkResponse({ is_recipe: true, ingredients: [], instructions: [] }));
		await expect(extractRecipeFromCaption("some caption", { fetchImpl })).rejects.toThrow(/couldn't find a recipe/i);
	});

	test("missing API key fails fast without calling fetchImpl", async () => {
		delete process.env.GEMINI_API_KEY;
		const fetchImpl = jest.fn();
		await expect(extractRecipeFromCaption("some caption", { fetchImpl })).rejects.toThrow(/try again later/i);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	test("Gemini HTTP error maps to a generic retry message", async () => {
		const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 429 });
		await expect(extractRecipeFromCaption("some caption", { fetchImpl })).rejects.toThrow(/try again later/i);
	});

	test("malformed (non-JSON) candidate text maps to a generic retry message", async () => {
		const fetchImpl = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }),
		});
		await expect(extractRecipeFromCaption("some caption", { fetchImpl })).rejects.toThrow(/try again later/i);
	});

	test("network/timeout error maps to a generic retry message", async () => {
		const fetchImpl = jest.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
		await expect(extractRecipeFromCaption("some caption", { fetchImpl })).rejects.toThrow(/try again later/i);
	});

	test("blank caption input rejects without calling fetchImpl", async () => {
		const fetchImpl = jest.fn();
		await expect(extractRecipeFromCaption("   ", { fetchImpl })).rejects.toThrow(/couldn't find a recipe/i);
		expect(fetchImpl).not.toHaveBeenCalled();
	});
});
