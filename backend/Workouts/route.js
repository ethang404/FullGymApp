const express = require("express");
const router = express.Router();

const controller = require("./controller");
const verifyToken = require("../Middlewear/token");

router.get("/GetWorkouts", verifyToken, controller.getWorkoutsList); //get list of workouts for some date range/filter perhaps
router.get("/GetWorkouts/:id", verifyToken, controller.getWorkout);

router.post("/AddWorkouts", verifyToken, controller.createWorkout); //Should create workout/sets/reps for user in one call

router.put("/EditWorkouts/:id", verifyToken, controller.editWorkout);

router.delete("/:id", verifyToken, controller.deleteWorkout);

module.exports = router;
