// Single source of truth for unit-to-grams resolution, including the
// automatic liquid/volume fallback

// TLDR; not every food has a clean "grams per unit" the user
// can type in, e.g. oils/honey/syrup behave differently per mL than water).

//Thought about making ml another ground truth and discriminating between food solids/oils
//But our USDA import uses grams for everything

//Volume units per 1ml
const VOLUME_UNITS_TO_ML = {
	ml: 1,
	l: 1000,
	tsp: 5,
	tbsp: 15,
	"fl oz": 30,
	cup: 240,
};

// Fallback grams-per-mL for foods with no explicit volume-unit serving size

//Matched against the food's name/brand via whole-word search so a
// substring like "oil" doesn't false-positive on e.g. "Broiled Chicken".

// Approximate values sourced from standard food density references, our best guess if all else fails for conversions. Mirror on frontend
const DENSITY_FALLBACK_TABLE = [
	{ keywords: ["olive oil", "vegetable oil", "canola oil", "coconut oil", "sesame oil", "oil"], gPerMl: 0.92 },
	{ keywords: ["honey"], gPerMl: 1.42 },
	{ keywords: ["maple syrup", "corn syrup", "syrup"], gPerMl: 1.33 },
	{ keywords: ["heavy cream", "whipping cream", "half and half", "cream"], gPerMl: 1.01 },
	{ keywords: ["yogurt", "yoghurt"], gPerMl: 1.03 },
	{ keywords: ["milk"], gPerMl: 1.03 },
	{ keywords: ["vinegar"], gPerMl: 1.01 },
	{ keywords: ["wine"], gPerMl: 0.99 },
	{ keywords: ["beer"], gPerMl: 1.01 },
	{ keywords: ["juice"], gPerMl: 1.04 },
	{ keywords: ["soda", "cola", "soft drink"], gPerMl: 1.04 },
	{ keywords: ["water"], gPerMl: 1.0 },
];

//does the string searching with complicated regex
function findDensityForFood(name, brand) {
	const haystack = `${name ?? ""} ${brand ?? ""}`.toLowerCase();
	for (const { keywords, gPerMl } of DENSITY_FALLBACK_TABLE) {
		for (const kw of keywords) {
			const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			if (new RegExp(`\\b${escaped}\\b`, "i").test(haystack)) return gPerMl;
		}
	}
	return null;
}

/**
 * Gives us grams per given unit of food
 *
 * Order of attempts:
 *   1. "g"/"kg/lb/oz": direct conversions
 *   2. See if current serving size is already in our list
 *   3. Look at other serving sizes and see if we can convert based off that
 *   ^^ Ratio derived from another explicit volume-unit row on this same food
 *      (e.g. food only has "tbsp" defined, user asks for "tsp"). Get the density and get 1 unit based off our known conversions
 *
 *   4. Category-keyword density fallback matched against name/brand. (our best guess)
 
 *   5. null -> unresolvable, caller decides error behavior. (fails)
 */
function resolveUnitWeightG(unit, servingSizes, foodName, foodBrand) {
	if (unit === "g") return 1;
	if (unit === "kg") return 1000;

	const explicit = servingSizes.find((s) => s.label === unit);
	if (explicit) return parseFloat(explicit.weight_g);

	// mg/lb/oz are fixed conversions, but only as a FALLBACK - same as every
	// other unit, an explicit food_serving_sizes row (checked above) always
	// wins
	if (unit === "mg") return 0.001;
	if (unit === "lb") return 453.592;
	if (unit === "oz") return 28.3495;

	//if unit is a unit we're aware of
	//retrieve grams equiv from another serving size (if we're looking for tsp, and have Tbsp. Get grams of Tbsp ==15)

	//if matches, grams_equiv / base truth conversion: yields density of food! (g/ml is a measure of density for liquids)
	//density * desired_serving_in_ml --> 1 "unit" of our given serving size

	//in service function we multiply that by quantity

	if (VOLUME_UNITS_TO_ML[unit] != null) {
		for (const s of servingSizes) {
			const knownMlPerUnit = VOLUME_UNITS_TO_ML[s.label];
			if (knownMlPerUnit != null) {
				const gPerMl = parseFloat(s.weight_g) / knownMlPerUnit; //density of food liquid (g/mL)
				return gPerMl * VOLUME_UNITS_TO_ML[unit];
			}
		}

		//if we don't have a reliable conversion of other serving sizes, do our best guess here based on known estimated density's
		const gPerMl = findDensityForFood(foodName, foodBrand);
		if (gPerMl != null) return gPerMl * VOLUME_UNITS_TO_ML[unit];
	}

	return null; //can't find a conversion
}

module.exports = {
	VOLUME_UNITS_TO_ML,
	DENSITY_FALLBACK_TABLE,
	findDensityForFood,
	resolveUnitWeightG,
};
