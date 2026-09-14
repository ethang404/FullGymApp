const { parseRecipeFromHtml, importRecipeFromUrl, _internal } = require("../recipeImport");

// Trimmed-down copy of the schema.org @graph a WP Recipe Maker page emits
// (the hungryhobby.net crockpot turkey meatballs example).
const SAMPLE_GRAPH = {
	"@context": "https://schema.org",
	"@graph": [
		{ "@type": "Article", "@id": "https://hungryhobby.net/crockpot-turkey-meatballs/#article", headline: "Crockpot Turkey Meatballs" },
		{ "@type": "WebPage", "@id": "https://hungryhobby.net/crockpot-turkey-meatballs/", name: "Crockpot Turkey Meatballs - Hungry Hobby" },
		{ "@type": "ImageObject", "@id": "https://hungryhobby.net/crockpot-turkey-meatballs/#primaryimage", url: "https://hungryhobby.net/img/primary.jpg" },
		{
			"@type": "Recipe",
			name: "Crockpot Turkey Meatballs Recipe",
			author: { "@type": "Person", name: "Kelli Shallal MPH RD" },
			description: "These turkey meatballs are tender, juicy, and so easy to make.",
			image: [
				"https://hungryhobby.net/img/550.jpg",
				"https://hungryhobby.net/img/500.jpg",
			],
			recipeYield: ["24", "24 meatballs"],
			prepTime: "PT10M",
			cookTime: "PT240M",
			totalTime: "PT250M",
			recipeIngredient: [
				"2 lbs 93% lean ground turkey  (can sub chicken )",
				"1 tablespoon dried onion flakes",
				"1/2 cup  chopped fresh parsley",
				"1/3 cup  chopped fresh basil",
				"1 tablespoon garlic powder",
				"1  tablespoon Italian seasoning",
				"1/2 tablespoon salt",
				"1/2 teaspoon black pepper",
				"1/4 cup  oat flour",
				"36 ounces marinara sauce",
			],
			recipeInstructions: [
				{ "@type": "HowToStep", text: "Combine the turkey, onion, parsley, basil, garlic powder, Italian seasoning, sea salt, black pepper, and oat flour in a large bowl." },
				{ "@type": "HowToStep", text: "Add a layer of sauce to the bottom of your crockpot." },
				{ "@type": "HowToStep", text: "Place the lid on the slow cooker and cook for 3-4 hours on high. I feel you I&#x27;m the same way." },
				{ "@type": "HowToStep", text: "Enjoy meatballs!" },
			],
			recipeCategory: ["Appetizer", "Dinner", "Lunch", "Meal Prep"],
			recipeCuisine: ["American", "Italian"],
			keywords: "crockpot meatballs, healthy turkey meatballs, slow cooker meatballs",
			nutrition: {
				"@type": "NutritionInformation",
				calories: "75 kcal",
				carbohydrateContent: "4 g",
				proteinContent: "8 g",
				fatContent: "3 g",
				saturatedFatContent: "1 g",
				sodiumContent: "250 mg",
				servingSize: "1 serving",
			},
		},
	],
};

const SAMPLE_HTML = `<!DOCTYPE html><html><head>
<title>Crockpot Turkey Meatballs</title>
<script type="application/ld+json">${JSON.stringify(SAMPLE_GRAPH)}</script>
</head><body><h1>Recipe</h1></body></html>`;

const SOURCE = "https://hungryhobby.net/crockpot-turkey-meatballs/";

describe("parseRecipeFromHtml", () => {
	let recipe;
	beforeAll(() => {
		recipe = parseRecipeFromHtml(SAMPLE_HTML, SOURCE);
	});

	test("pulls scalar fields off the Recipe node", () => {
		expect(recipe.name).toBe("Crockpot Turkey Meatballs Recipe");
		expect(recipe.author).toBe("Kelli Shallal MPH RD");
		expect(recipe.description).toMatch(/tender, juicy/);
		expect(recipe.source_url).toBe(SOURCE);
	});

	test("ingredients come back as a flat string array", () => {
		expect(Array.isArray(recipe.ingredients)).toBe(true);
		expect(recipe.ingredients).toHaveLength(10);
		expect(recipe.ingredients[0]).toBe("2 lbs 93% lean ground turkey (can sub chicken )");
		expect(recipe.ingredients[9]).toBe("36 ounces marinara sauce");
	});

	test("instructions are flattened to text and entity-decoded", () => {
		expect(recipe.instructions).toHaveLength(4);
		expect(recipe.instructions[3]).toBe("Enjoy meatballs!");
		expect(recipe.instructions[2]).toContain("I'm the same way");
		expect(recipe.instructions[2]).not.toContain("&#x27;");
	});

	test("servings parsed from the first recipeYield entry", () => {
		expect(recipe.servings).toBe(24);
		expect(recipe.recipe_yield).toEqual(["24", "24 meatballs"]);
	});

	test("ISO-8601 durations converted to minutes", () => {
		expect(recipe.prep_time_minutes).toBe(10);
		expect(recipe.cook_time_minutes).toBe(240);
		expect(recipe.total_time_minutes).toBe(250);
	});

	test("nutrition numbers stripped of units", () => {
		expect(recipe.nutrition).toMatchObject({
			calories: 75,
			protein_g: 8,
			carbs_g: 4,
			fat_g: 3,
			saturated_fat_g: 1,
			sodium_mg: 250,
			serving_size: "1 serving",
		});
	});

	test("keywords / categories / cuisines are arrays", () => {
		expect(recipe.keywords).toEqual(["crockpot meatballs", "healthy turkey meatballs", "slow cooker meatballs"]);
		expect(recipe.categories).toEqual(["Appetizer", "Dinner", "Lunch", "Meal Prep"]);
		expect(recipe.cuisines).toEqual(["American", "Italian"]);
	});

	test("image resolves to the first usable url", () => {
		expect(recipe.image).toBe("https://hungryhobby.net/img/550.jpg");
	});
});

describe("parseRecipeFromHtml — error paths", () => {
	test("no JSON-LD at all", () => {
		expect(() => parseRecipeFromHtml("<html><head></head><body>nope</body></html>", SOURCE)).toThrow(/structured recipe data/i);
	});

	test("JSON-LD present but no Recipe node", () => {
		const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "WebPage", name: "x" })}</script>`;
		expect(() => parseRecipeFromHtml(html, SOURCE)).toThrow(/no recipe/i);
	});

	test("Recipe node with no ingredients", () => {
		const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "Recipe", name: "x", recipeIngredient: [] })}</script>`;
		expect(() => parseRecipeFromHtml(html, SOURCE)).toThrow(/ingredients/i);
	});

	test("unparseable JSON-LD block is skipped, not fatal, when another block works", () => {
		const html = `
			<script type="application/ld+json">{ bad json ,, }</script>
			<script type="application/ld+json">${JSON.stringify(SAMPLE_GRAPH)}</script>`;
		expect(parseRecipeFromHtml(html, SOURCE).name).toBe("Crockpot Turkey Meatballs Recipe");
	});

	test("finds Recipe when @type is an array", () => {
		const html = `<script type="application/ld+json">${JSON.stringify({
			"@type": ["Recipe", "NewsArticle"],
			name: "Combo",
			recipeIngredient: ["1 egg"],
		})}</script>`;
		expect(parseRecipeFromHtml(html, SOURCE).name).toBe("Combo");
	});
});

describe("_internal helpers", () => {
	test("parseDurationToMinutes", () => {
		const { parseDurationToMinutes } = _internal;
		expect(parseDurationToMinutes("PT10M")).toBe(10);
		expect(parseDurationToMinutes("PT1H30M")).toBe(90);
		expect(parseDurationToMinutes("P1DT2H")).toBe(1560);
		expect(parseDurationToMinutes("garbage")).toBeNull();
		expect(parseDurationToMinutes(null)).toBeNull();
	});

	test("parseServings", () => {
		const { parseServings } = _internal;
		expect(parseServings(4)).toBe(4);
		expect(parseServings("4 servings")).toBe(4);
		expect(parseServings(["6", "6 bars"])).toBe(6);
		expect(parseServings(undefined)).toBeNull();
	});

	test("flattenInstructions handles HowToSection nesting", () => {
		const { flattenInstructions } = _internal;
		const out = flattenInstructions([
			{ "@type": "HowToSection", itemListElement: [{ "@type": "HowToStep", text: "Step A" }, { "@type": "HowToStep", text: "Step B" }] },
			"Step C",
		]);
		expect(out).toEqual(["Step A", "Step B", "Step C"]);
	});

	test("assertSafeUrl rejects non-http and private hosts", () => {
		const { assertSafeUrl } = _internal;
		expect(() => assertSafeUrl("ftp://example.com")).toThrow();
		expect(() => assertSafeUrl("http://localhost/x")).toThrow();
		expect(() => assertSafeUrl("http://127.0.0.1/x")).toThrow();
		expect(() => assertSafeUrl("http://192.168.1.10/x")).toThrow();
		expect(() => assertSafeUrl("http://169.254.169.254/latest/meta-data")).toThrow();
		expect(assertSafeUrl("https://example.com/recipe").href).toBe("https://example.com/recipe");
	});
});

describe("importRecipeFromUrl", () => {
	const okResponse = (body, headers = { "content-type": "text/html" }) => ({
		ok: true,
		status: 200,
		headers: { get: (k) => headers[k.toLowerCase()] ?? null },
		text: async () => body,
	});

	test("fetches the URL and returns the parsed recipe", async () => {
		const fetchImpl = jest.fn().mockResolvedValue(okResponse(SAMPLE_HTML));
		const recipe = await importRecipeFromUrl(SOURCE, { fetchImpl });

		expect(fetchImpl).toHaveBeenCalledWith(SOURCE, expect.objectContaining({ redirect: "follow" }));
		expect(recipe.ingredients).toHaveLength(10);
	});

	test("rejects a blank url", async () => {
		await expect(importRecipeFromUrl("   ", { fetchImpl: jest.fn() })).rejects.toThrow(/required/i);
	});

	test("surfaces an HTTP error from the target site", async () => {
		const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 404, headers: { get: () => null }, text: async () => "" });
		await expect(importRecipeFromUrl(SOURCE, { fetchImpl })).rejects.toThrow(/HTTP 404/);
	});

	test("rejects non-html content types", async () => {
		const fetchImpl = jest.fn().mockResolvedValue(okResponse("{}", { "content-type": "application/json" }));
		await expect(importRecipeFromUrl(SOURCE, { fetchImpl })).rejects.toThrow(/web page/i);
	});

	test("maps an aborted/slow fetch to a friendly message", async () => {
		const fetchImpl = jest.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
		await expect(importRecipeFromUrl(SOURCE, { fetchImpl })).rejects.toThrow(/too long/i);
	});
});
