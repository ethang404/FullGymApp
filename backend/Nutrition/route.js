const express = require("express");
const router = express.Router();

//import middlwear
const verifyToken = require("../Middlewear/token");
const controller = require("./controller");

//router.get("/protected",)

router.get("/protected", verifyToken, (req, res) => {
	res.send("Birds home page");
});

//okay so what's important the user should be able to do regarding nutrition

//1. Be able to add foods to the foods table, either through scanning or manually
//1.1 doing do should add corresponding food nutrients

//2 Users should be able to add food enteries to diary to track what they ate in a day

//endpoints for foods (CRUD stuff)
router.get("/", verifyToken, controller.searchFoods);//query for food item
router.post("/", verifyToken, controller.createFood);//Add new food item by user

router.get("/:id", verifyToken, controller.getWorkout); //get one workout
router.post("/", verifyToken, controller.createWorkout); //Should create workout/sets/reps for user in one call
router.put("/:id", verifyToken, controller.editWorkout);
router.delete("/:id", verifyToken, controller.deleteWorkout);

//endpoints for creating new reciepes

module.exports = router;
