const service = require("./service");

// ---------------------------------------------
// FOOD related endpoints
// ---------------------------------------------

// /foods?query=chicken
async function searchFoods(req, res) {
	const { q } = req.query;
	const foods = await service.SearchFoods(q);
	return res.status(200).json({ foods });
}

// Body needs: { name, brand?, barcode?, nutrients: [...], serving_sizes: [{label, weight_g, default_quantity?}] }
async function createFood(req, res) {
	const user_id = req.user_id;
	const food = await service.CreateFood(req.body, user_id);
	return res.status(201).json({ food });
}

async function getFood(req, res) {
	const { id } = req.params;
	const food = await service.getFood(id);
	return res.status(200).json({ food });
}

async function addFoodServing(req, res) {
	const { id } = req.params;
	const { label, weight_g, default_quantity } = req.body;

	const foodServing = await service.addFoodServing(id, label, weight_g, default_quantity);
	return res.status(200).json({ foodServing });
}

// ---------------------------------------------
// Diary Entry controls
// ---------------------------------------------

// /diary?start_date=2024-01-01&end_date=2024-01-07&meal_type=breakfast
async function getDiaryEntries(req, res) {
	const { start_date, end_date, meal_type } = req.query;
	const user_id = req.user_id;
	const diary_entries = await service.getDiaryEntries(user_id, start_date, end_date, meal_type);
	return res.status(200).json({ diary_entries });
}

// Body needs: { food_id, meal_type, logged_at, quantity, unit }
async function addDiaryEntry(req, res) {
	const user_id = req.user_id;
	const diary_entry = await service.addDiaryEntry(req.body, user_id);
	return res.status(201).json({ diary_entry });
}

// and id
// Body: { quantity?, unit?, meal_type?, logged_at? }
async function editDiaryEntry(req, res) {
	const user_id = req.user_id;
	const entry_id = parseInt(req.params.id, 10);
	const diary_entry = await service.editDiaryEntry(entry_id, req.body, user_id);
	return res.status(200).json({ diary_entry });
}

async function deleteDiaryEntry(req, res) {
	const user_id = req.user_id;
	const entry_id = parseInt(req.params.id, 10);
	const result = await service.deleteDiaryEntry(entry_id, user_id);
	return res.status(200).json(result);
}

// /recent — recently logged distinct foods + recipes, newest first
async function getRecentLogged(req, res) {
	const user_id = req.user_id;
	const recent = await service.getRecentLogged(user_id);
	return res.status(200).json({ recent });
}

// ---------------------------------------------
// recipes
// ---------------------------------------------

// get all recipes
async function getRecipes(req, res) {
	const user_id = req.user_id;
	const recipes = await service.getRecipes(user_id);
	return res.status(200).json({ recipes });
}

//get one recipe
async function getRecipe(req, res) {
	const user_id = req.user_id;
	const recipe_id = parseInt(req.params.id, 10);
	const recipe = await service.getRecipe(recipe_id, user_id);
	return res.status(200).json({ recipe });
}

// Body needs: { name, description?, ingredients: [{ food_id, quantity, unit }] }
async function createRecipe(req, res) {
	const user_id = req.user_id;
	const recipe = await service.createRecipe(req.body, user_id);
	return res.status(201).json({ recipe });
}

async function deleteRecipe(req, res) {
	const user_id = req.user_id;
	const recipe_id = parseInt(req.params.id, 10);
	const result = await service.deleteRecipe(recipe_id, user_id);
	return res.status(200).json(result);
}

async function editRecipe(req, res) {
	const user_id = req.user_id;
	const recipe_id = parseInt(req.params.id, 10);
	const recipe = await service.editRecipe(recipe_id, user_id, req.body);
	return res.status(200).json({ recipe });
}

// Body: { url }
// Fetches the page, parses its schema.org JSON-LD, and returns the recipe as
// flat arrays (ingredients, instructions, ...). Does NOT persist anything —
// the client matches ingredients to foods and calls POST /recipes afterwards.
async function importRecipe(req, res) {
	const recipe = await service.importRecipeFromUrl(req.body?.url);
	return res.status(200).json({ recipe });
}

module.exports = {
	searchFoods,
	createFood,
	getFood,
	addFoodServing,

	getDiaryEntries,
	addDiaryEntry,
	editDiaryEntry,
	deleteDiaryEntry,
	getRecentLogged,

	getRecipes,
	getRecipe,
	createRecipe,
	editRecipe,
	deleteRecipe,
	importRecipe,
};
