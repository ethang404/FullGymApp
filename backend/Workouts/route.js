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

// have to put before "/:id" or it will think "catalog" is "":id"
router.get("/catalog", verifyToken, controller.searchCatalog); //search/list catalog exercises, e.g. /workouts/catalog?search=press&muscle_group=chest
router.post("/catalog", verifyToken, controller.createCatalogExercise); //add a new exercise to the catalog
router.get("/catalog/:id/history", verifyToken, controller.getExerciseHistory); //weight/reps or Epley 1RM over time for one catalog exercise

router.get("/progress/biggest-changes", verifyToken, controller.getBiggestChanges); //top 5 biggest % lift changes in a date range
router.get("/progress/volume-by-muscle-group", verifyToken, controller.getVolumeByMuscleGroup); //volume split by muscle group, for a pie chart
router.get("/progress/fatigue-curves", verifyToken, controller.getFatigueCurves); //avg e1RM/weight by order_number position, per exercise
router.get("/progress/weekly-volume-landmarks", verifyToken, controller.getWeeklyVolumeLandmarks); //high/moderate/low sets per muscle group per week
router.get("/progress/personal-records", verifyToken, controller.getPersonalRecordTimeline); //feed of all-time PR events
router.get("/progress/training-frequency", verifyToken, controller.getTrainingFrequency); //sessions logged per week
router.get("/progress/session-trends", verifyToken, controller.getSessionTrends); //avg session volume/duration per week
router.get("/progress/rep-range-distribution", verifyToken, controller.getRepRangeDistribution); //% of working sets by rep range

router.get("/", verifyToken, controller.getWorkoutsList); //get list of workouts for some date range/filter perhaps
router.get("/:id", verifyToken, controller.getWorkout); //get one workout
router.post("/", verifyToken, controller.createWorkout); //Should create workout/sets/reps for user in one call
router.put("/:id", verifyToken, controller.editWorkout);
router.delete("/:id", verifyToken, controller.deleteWorkout);

//endpoints for exercise catalog

module.exports = router;
