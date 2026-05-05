const service = require("./service");
const jwt = require("jsonwebtoken");

function getUserId(req) {
	const accessToken = req.headers.authorization.split(" ")[1];
	const user = jwt.verify(accessToken, process.env.JWT_SECRET, {
		audience: "my-gym-app",
		issuer: "gym-auth-server",
	});
	return user.user_id;
}

function handleError(res, error) {
	console.error(error);
	if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
	return res.status(500).json({ message: error.message });
}

// ---------------------------------------------
// FOOD related endpoints
// ---------------------------------------------

// /foods?query=chicken
async function searchFoods(req, res) {
	const { q } = req.query;
	try {
		const foods = await service.SearchFoods(q);
		return res.status(200).json({ foods });
	} catch (error) {
		return handleError(res, error);
	}
}

// Body needs: { name, brand, barcode, serving_size_g, serving_size_label, nutrients: [...] }
async function createFood(req, res) {
	const user_id = getUserId(req);
	try {
		const food = await service.CreateFood(req.body, user_id);
		return res.status(201).json({ food });
	} catch (error) {
		return handleError(res, error);
	}
}

// ---------------------------------------------
// Diary Entry controls
// ---------------------------------------------

// /diary?start_date=2024-01-01&end_date=2024-01-07&meal_type=breakfast
async function getDiaryEntries(req, res) {
	const { start_date, end_date, meal_type } = req.query;
	const user_id = getUserId(req);
	try {
		const diary_entries = await service.getDiaryEntries(user_id, start_date, end_date, meal_type);
		return res.status(200).json({ diary_entries });
	} catch (error) {
		return handleError(res, error);
	}
}

// Body needs: { food_id, meal_type, logged_at, quantity, unit }
async function addDiaryEntry(req, res) {
	const user_id = getUserId(req);
	try {
		const diary_entry = await service.addDiaryEntry(req.body, user_id);
		return res.status(201).json({ diary_entry });
	} catch (error) {
		return handleError(res, error);
	}
}

// and id
// Body: { quantity?, unit?, meal_type?, logged_at? }
async function editDiaryEntry(req, res) {
	const user_id = getUserId(req);
	const entry_id = parseInt(req.params.id, 10);
	try {
		const diary_entry = await service.editDiaryEntry(entry_id, req.body, user_id);
		return res.status(200).json({ diary_entry });
	} catch (error) {
		return handleError(res, error);
	}
}

async function deleteDiaryEntry(req, res) {
	const user_id = getUserId(req);
	const entry_id = parseInt(req.params.id, 10);
	try {
		const result = await service.deleteDiaryEntry(entry_id, user_id);
		return res.status(200).json(result);
	} catch (error) {
		return handleError(res, error);
	}
}

// ---------------------------------------------
// recipes
// ---------------------------------------------

// get all recipes
async function getRecipes(req, res) {
	const user_id = getUserId(req);
	try {
		const recipes = await service.getRecipes(user_id);
		return res.status(200).json({ recipes });
	} catch (error) {
		return handleError(res, error);
	}
}

//get one recipe
async function getRecipe(req, res) {
	const user_id = getUserId(req);
	const saved_meal_id = parseInt(req.params.id, 10);
	try {
		const recipe = await service.getRecipe(saved_meal_id, user_id);
		return res.status(200).json({ recipe });
	} catch (error) {
		return handleError(res, error);
	}
}

// Body needs: { name, description?, ingredients: [{ food_id, quantity, unit }] }
async function createRecipe(req, res) {
	const user_id = getUserId(req);
	try {
		const recipe = await service.createRecipe(req.body, user_id);
		return res.status(201).json({ recipe });
	} catch (error) {
		return handleError(res, error);
	}
}

// and id to update
// Body: { name, description? }
async function updateRecipe(req, res) {
	const user_id = getUserId(req);
	const saved_meal_id = parseInt(req.params.id, 10);
	try {
		const recipe = await service.updateRecipe(saved_meal_id, req.body, user_id);
		return res.status(200).json({ recipe });
	} catch (error) {
		return handleError(res, error);
	}
}

async function deleteRecipe(req, res) {
	const user_id = getUserId(req);
	const saved_meal_id = parseInt(req.params.id, 10);
	try {
		const result = await service.deleteRecipe(saved_meal_id, user_id);
		return res.status(200).json(result);
	} catch (error) {
		return handleError(res, error);
	}
}

// update a recipe ingrediant like /recipes/:id/ingredients
// Body just needs: { food_id, quantity, unit }
async function addRecipeIngredient(req, res) {
	const user_id = getUserId(req);
	const saved_meal_id = parseInt(req.params.id, 10);
	try {
		const ingredient = await service.addRecipeIngredient(saved_meal_id, req.body, user_id);
		return res.status(201).json({ ingredient });
	} catch (error) {
		return handleError(res, error);
	}
}

// DELETE /recipes/:id/ingredients/:ingredient_id
async function removeRecipeIngredient(req, res) {
	const user_id = getUserId(req);
	const ingredient_id = parseInt(req.params.ingredient_id, 10);
	try {
		const result = await service.removeRecipeIngredient(ingredient_id, user_id);
		return res.status(200).json(result);
	} catch (error) {
		return handleError(res, error);
	}
}

module.exports = {
	searchFoods,
	createFood,

	getDiaryEntries,
	addDiaryEntry,
	editDiaryEntry,
	deleteDiaryEntry,

	getRecipes,
	getRecipe,
	createRecipe,
	updateRecipe,
	deleteRecipe,
	addRecipeIngredient,
	removeRecipeIngredient,
};
