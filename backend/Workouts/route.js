const express = require("express");
const router = express.Router();

const controller = require("./controller");
const verifyToken = require("../Middlewear/token");

//Get Workouts
//Get one workout
//Create workout
//Edit workout
//Delete workout

//No need for specific endpoints for sets/exercises I don't think. Since they're dependent on workout and handled in edit func

//I changed these endpoints since the method kind of tells what operation to do. People online say it's better
//I disgree tbh. But whatever

router.get("/", verifyToken, controller.getWorkoutsList); //get list of workouts for some date range/filter perhaps
router.get("/:id", verifyToken, controller.getWorkout); //get one workout
router.post("/", verifyToken, controller.createWorkout); //Should create workout/sets/reps for user in one call
router.put("/:id", verifyToken, controller.editWorkout);
router.delete("/:id", verifyToken, controller.deleteWorkout);

module.exports = router;
