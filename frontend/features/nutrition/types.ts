// Shapes used across the nutrition feature: what the API returns and sends, plus
// the local form state a few screens keep.

// ---------------------------------------------
// Foods
// ---------------------------------------------

export interface ServingSize {
	label: string;
	weight_g: number;
	default_quantity?: number | null;
}

export interface MacroPer100g {
	nutrient_id: number;
	name: string;
	unit: string;
	amount_per_100g: number;
}

export interface CalculatedNutrient extends MacroPer100g {
	//we use this to calculate all nutrients vals with our conversions
	amount: number; //stores converted amounts
}

// GET /nutrition/foods/:id
export interface FoodDetail {
	id: number;
	name: string;
	brand?: string | null;
	serving_sizes: ServingSize[];
	nutrients_per_100g: MacroPer100g[];
}

export interface Macro {
	nutrient_id: number;
	name: string;
	unit: string;
	amount: number;
}

export interface DefaultServing {
	label: string; // like "oz" or "serving"
	weight_g: number;
	default_quantity?: number | null;
	macros: Macro[];
}

// One result from GET /nutrition/foods?q=
export interface FoodSearchResult {
	id: number;
	name: string;
	brand?: string;
	serving_sizes: ServingSize[];
	default_serving: DefaultServing;
	nutrients_per_100g: MacroPer100g[];
}

// POST /nutrition/foods
export interface NewFood {
	name: string;
	brand: string | null;
	barcode: string | null;
	serving_sizes: ServingSize[];
	nutrients: { nutrient_name: string; unit: string; nutrient_amount: number }[];
}

// ---------------------------------------------
// Diary
// ---------------------------------------------

// Canonical values match the backend meal_type enum. Display labels are separate
// (we still want to show "Snacks" even though the stored value is "snack").
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

// One row of GET /nutrition/diary
export interface DiaryEntry {
	id: number;
	type: "food" | "recipe";
	meal_type: string;
	quantity: number;
	unit: string;
	nutrients: Record<string, number>;
	food?: { id: string; name: string; brand?: string };
	recipe?: { id: string; name: string };
}

// POST /nutrition/diary - log either a food or a recipe
export type NewDiaryEntry = {
	meal_type: string;
	logged_at?: string;
	quantity: number;
	unit: string;
} & ({ food_id: number } | { recipe_id: string });

// ---------------------------------------------
// Recipes
// ---------------------------------------------

// Recipe list summary — shape returned by GET /nutrition/recipes and by the
// recipe entries of GET /nutrition/recent. Enough to render a card and log it.
export interface RecipeSummary {
	id: string;
	name: string;
	servings: number;
	calories_per_serving: number;
	protein_per_serving: number;
	carbs_per_serving: number;
	fat_per_serving: number;
}

// One entry from GET /nutrition/recent — a recently logged food or recipe,
// shaped so the same cards (FoodCard / RecipeLogCard) can render it.
export type RecentLoggedItem = { type: "food"; food: FoodSearchResult } | { type: "recipe"; recipe: RecipeSummary };

// One ingredient of GET /nutrition/recipes/:id, as the backend sends it
export interface SavedRecipeIngredient {
	ingredient_id: number | string;
	food_id: number;
	food_name: string;
	quantity: number;
	unit: string;
	serving_sizes?: ServingSize[];
	nutrients_per_100g: MacroPer100g[];
}

// GET /nutrition/recipes/:id
export interface SavedRecipe {
	name?: string;
	servings?: number;
	ingredients?: SavedRecipeIngredient[];
}

// POST /nutrition/recipes and PUT /nutrition/recipes/:id
export interface RecipePayload {
	name: string;
	servings: number;
	ingredients: { food_id: number; quantity: number; unit: string }[];
}

//An ingredient on the recipe editor screen
export interface RecipeIngredient {
	id: string; // local-only id, e.g. `${food.id}-${Date.now()}`
	food: FoodSearchResult;
	quantity: number;
	baseQuantity: number;
	serving: ServingSize;
	cals: number;
	protein: number;
	carbs: number;
	fat: number;
}

// Shape returned by POST /nutrition/recipes/import — a recipe web page's
// schema.org JSON-LD, normalized into flat arrays. Nothing is persisted; the
// client matches `ingredients` strings to foods and then calls POST /recipes.
export interface ImportedRecipeNutrition {
	calories: number | null;
	protein_g: number | null;
	carbs_g: number | null;
	fat_g: number | null;
	saturated_fat_g: number | null;
	fiber_g: number | null;
	sugar_g: number | null;
	sodium_mg: number | null;
	cholesterol_mg: number | null;
	serving_size: string | null;
}

export interface ImportedRecipe {
	source_url: string;
	name: string | null;
	description: string | null;
	author: string | null;
	image: string | null;
	servings: number | null;
	recipe_yield: string[];
	prep_time_minutes: number | null;
	cook_time_minutes: number | null;
	total_time_minutes: number | null;
	ingredients: string[];
	instructions: string[];
	nutrition: ImportedRecipeNutrition | null;
	keywords: string[];
	categories: string[];
	cuisines: string[];
}

export interface ParsedIngredientLine {
	quantity: number | null;
	unit: string | null; // a token from COMMON_UNITS/SERVING_UNIT_OPTIONS, or null if unrecognized
	searchText: string; // cleaned food name - safe to hand to GET /nutrition/foods?q=
}

// ---------------------------------------------
// Create food form
// ---------------------------------------------

export interface ServingSizeRow {
	name: string; // unit label as it appears on the package, e.g. "oz", "slice", "Grams (g)"
	qty: string; // how many of that unit make up the gram equivalent, e.g. "4"
	weight_g: string; // gram equivalent for that qty, e.g. "112"
	// Tracks WHO last set weight_g, so auto-derived guesses can keep updating
	// as the user refines the food name/brand, without ever clobbering a
	// value the user actually typed themselves:
	//   undefined -> blank, never touched, eligible for auto-fill
	//   true      -> we derived this (sibling ratio or density guess) - keep re-deriving
	//   false     -> the user typed this directly - never touch again
	autoFilled?: boolean;
}

export interface MicronutrientField {
	nutrient_name: string; // must match backend value verbatim
	nutrient_id: number;
	label: string;
	unit: string;
	value: string;
}
