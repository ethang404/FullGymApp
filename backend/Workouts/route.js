const express = require("express");
const router = express.Router();

const controller = require("./controller");
const verifyToken = require("../middlewear/token");

//Get Workouts
//Get one workout
//Create workout
//Edit workout
//Delete workout

//No need for specific endpoints for sets/exercises I don't think. Since they're dependent on workout and handled in edit func

//I changed these endpoints since the method kind of tells what operation to do. People online say it's better
//I disgree tbh. But whatever

// have to put before "/:id" or it will think "catalog" is "":id"
router.get("/catalog", verifyToken, controller.searchCatalog); //search/list catalog exercises, e.g. /workouts/catalog?search=press&muscle_group=chest
router.post("/catalog", verifyToken, controller.createCatalogExercise); //add a new exercise to the catalog
router.get("/catalog/:id/history", verifyToken, controller.getExerciseHistory); //best set per workout (weight, reps, e1RM) over time for one catalog exercise

router.get("/exercise-stats", verifyToken, controller.getExerciseStats); //best weight + last session's sets per catalog exercise, e.g. /workouts/exercise-stats?catalog_ids=1,4&exclude_workout_id=28

router.get("/progress/biggest-changes", verifyToken, controller.getBiggestChanges); //top 5 biggest % lift changes in a date range
router.get("/progress/lifts", verifyToken, controller.getLoggedLifts); //every lift logged in a date range, for the lift picker
router.get("/progress/volume-by-muscle-group", verifyToken, controller.getVolumeByMuscleGroup); //working sets + reps per muscle group

router.get("/", verifyToken, controller.getWorkoutsList); //get list of workouts for some date range/filter perhaps
router.get("/:id", verifyToken, controller.getWorkout); //get one workout
router.post("/", verifyToken, controller.createWorkout); //Should create workout/sets/reps for user in one call
router.put("/:id", verifyToken, controller.editWorkout);
router.delete("/:id", verifyToken, controller.deleteWorkout);

//endpoints for exercise catalog

module.exports = router;
