const express = require("express");
const router = express.Router();

const controller = require("./controller");
const verifyToken = require("../middlewear/token");

router.get("/GetWorkouts", /*verifyToken,*/ controller.getWorkoutsList); //get list of workouts for some date range/filter perhaps

router.post("/AddWorkout", verifyToken, controller.createWorkout); //Should create workout/sets/reps for user in one call

router.put("/EditWorkout/:id", verifyToken, controller.editWorkout);
//router.post("AddSet/", verifyToken, controller.addSet);

module.exports = router;
