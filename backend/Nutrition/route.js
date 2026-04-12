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
// Foods
router.get("/foods", verifyToken, controller.searchFoods);
router.post("/foods", verifyToken, controller.createFood);

// Diary Entries
router.get("/diary", verifyToken, controller.getDiaryEntries);
router.post("/diary", verifyToken, controller.addDiaryEntry);
router.put("/diary/:id", verifyToken, controller.editDiaryEntry);
router.delete("/diary/:id", verifyToken, controller.deleteDiaryEntry);

//endpoints for creating new reciepes

module.exports = router;
