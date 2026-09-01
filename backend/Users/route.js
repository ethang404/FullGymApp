const express = require("express");
const router = express.Router();

const controller = require("./controller");
const verifyToken = require("../Middlewear/token");

// Current user's profile: identity, body metrics, goal macros (raw + effective).
router.get("/me", verifyToken, controller.getMe);

// Partial update of identity / body metrics / goals / onboarding flag.
router.patch("/me", verifyToken, controller.updateMe);

// Mifflin–St Jeor suggestion from body metrics. Does not persist anything.
router.post("/me/goals/estimate", verifyToken, controller.estimateGoals);

module.exports = router;
