import { instance } from "@/utils/AuthAPI";
import type {
	DiaryEntry,
	FoodDetail,
	FoodSearchResult,
	ImportedRecipe,
	NewDiaryEntry,
	NewFood,
	RecentLoggedItem,
	RecipePayload,
	RecipeSummary,
	SavedRecipe,
	ServingSize,
} from "./types";

// Every nutrition endpoint the app calls. These only talk to the server and hand
// back the data (or throw) - loading flags, toasts and navigation belong to the caller.

// ---------------- Diary ----------------

// One day's entries (start and end are the same date)
export async function getDiary(date: string): Promise<DiaryEntry[]> {
	const res = await instance.get(`/nutrition/diary?start_date=${date}&end_date=${date}`);
	return res.data.diary_entries ?? [];
}

export async function addDiaryEntry(entry: NewDiaryEntry): Promise<void> {
	await instance.post("/nutrition/diary", entry);
}

// Recently logged distinct foods + recipes, newest first
export async function getRecentLogged(): Promise<RecentLoggedItem[]> {
	const res = await instance.get("/nutrition/recent");
	return res.data.recent ?? [];
}

// ---------------- Foods ----------------

export async function searchFoods(query: string): Promise<FoodSearchResult[]> {
	const trimmed = query.trim();
	if (!trimmed) return [];
	const res = await instance.get(`/nutrition/foods?q=${encodeURIComponent(trimmed)}`);
	return res.data.foods ?? [];
}

// One food with its full nutrient list, for the food detail screen
export async function getFood(foodId: number | string): Promise<FoodDetail> {
	const res = await instance.get(`/nutrition/foods/${foodId}`);
	return res.data.food;
}

// Same endpoint as getFood, typed as a search result. Search results only carry the
// 4 macro nutrients (see SearchFoods' MACRO_IDS in backend/Nutrition/service.js) -
// fetching one food by id returns the full nutrients_per_100g list, which
// RecipeIngredient needs for accurate label math. Shared by RecipeFoodCard (manual
// add) and the imported-recipe auto-matcher so both build ingredients the same way.
export async function getFullFood(foodId: number): Promise<FoodSearchResult> {
	const res = await instance.get(`/nutrition/foods/${foodId}`);
	return res.data.food ?? res.data;
}

export async function createFood(food: NewFood): Promise<void> {
	await instance.post("/nutrition/foods", food);
}

export async function addServingSize(foodId: number, serving: { label: string; weight_g: number; default_quantity: number }): Promise<ServingSize> {
	const res = await instance.post(`/nutrition/foods/${foodId}/serving-sizes`, serving);
	const saved = res.data.foodServing;
	return {
		label: saved.label,
		weight_g: parseFloat(saved.weight_g), //convert from string to number...change on backend later
		default_quantity: saved.default_quantity != null ? parseFloat(saved.default_quantity) : serving.default_quantity,
	};
}

// ---------------- Recipes ----------------

export async function getRecipes(): Promise<RecipeSummary[]> {
	const res = await instance.get("/nutrition/recipes");
	return res.data.recipes ?? res.data ?? [];
}

export async function getRecipe(recipeId: string): Promise<SavedRecipe> {
	const res = await instance.get(`/nutrition/recipes/${recipeId}`);
	return res.data.recipe ?? res.data;
}

export async function createRecipe(recipe: RecipePayload): Promise<void> {
	await instance.post("/nutrition/recipes", recipe);
}

export async function updateRecipe(recipeId: string, recipe: RecipePayload): Promise<void> {
	await instance.put(`/nutrition/recipes/${recipeId}`, recipe);
}

// The backend reads the page's schema.org recipe data - nothing is saved yet
export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
	const res = await instance.post("/nutrition/recipes/import", { url });
	return res.data.recipe ?? res.data;
}
