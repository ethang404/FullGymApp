const express = require("express");
const router = express.Router();
const controller = require("./controller");
const verifyToken = require("../Middlewear/token");

// ---------------------------------------------
// Foods -> For users to enter/retrieve foods
// ---------------------------------------------
// GET  query looks like: /foods?query=chicken          search existing foods by keyword (index'd with GIN to find mispells/subwords)
// POST /foods                        create new food + food nutrients with it
router.get("/foods", verifyToken, controller.searchFoods);
router.post("/foods", verifyToken, controller.createFood);
router.post("/foods/:id/serving-sizes", verifyToken, controller.addFoodServing);

// ---------------------------------------------
// Diary Entries
// ---------------------------------------------
// GET   endpoint looks like: /diary?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&meal_type=breakfast
router.get("/diary", verifyToken, controller.getDiaryEntries);
router.post("/diary", verifyToken, controller.addDiaryEntry);
router.put("/diary/:id", verifyToken, controller.editDiaryEntry);
router.delete("/diary/:id", verifyToken, controller.deleteDiaryEntry);

// ---------------------------------------------
// Recipes (Saved Meals)
// ---------------------------------------------
//Basic crud endpoints for updating and creating and deleting recipes
// And adding/removing/updating recipe ingrediants
// POST   /recipes                            create recipe + ingredients in one go
// PUT    /recipes/:id                        update name / description
// DELETE /recipes/:id                        delete recipe (cascades ingredients)
// POST   /recipes/:id/ingredients            add ingredient to existing recipe
// DELETE /recipes/:id/ingredients/:iid       remove one ingredient

router.get("/recipes", verifyToken, controller.getRecipes);
router.get("/recipes/:id", verifyToken, controller.getRecipe);

router.post("/recipes", verifyToken, controller.createRecipe);
router.put("/recipes/:id", verifyToken, controller.editRecipe);
router.delete("/recipes/:id", verifyToken, controller.deleteRecipe);

module.exports = router;
