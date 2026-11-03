const express = require("express");
const router = express.Router();
const validateIdParam = require("../middlewear/validateIdParam");

//numeric route params -> 400 if they aren't a valid id (instead of a postgres 500)
router.param("id", validateIdParam);

const controller = require("./controller");
const verifyToken = require("../middlewear/token");
const blockGuest = require("../middlewear/checkIsGuest");

// Current user's profile: identity, body metrics, goal macros (raw + effective).
router.get("/me", verifyToken, controller.getMe);

// Partial update of identity / body metrics / goals / onboarding flag.
router.patch("/me", verifyToken, controller.updateMe);

// Permanently delete the account and all of its data (workouts, diary, recipes).
router.delete("/me", verifyToken, controller.deleteMe);

// Mifflin–St Jeor suggestion from body metrics. Does not persist anything.
router.post("/me/goals/estimate", verifyToken, controller.estimateGoals);

// ---------------------------------------------
// Social (non-guest only)
// ---------------------------------------------
// have to put before "/:id" routes or it will think "search" is an id
router.get("/search", verifyToken, blockGuest, controller.searchUsers); //e.g. /users/search?q=ali. Minimal fields only, hides blocks

// Blocking - one-way rows, two-way effect. Only the blocker can unblock
router.get("/me/blocks", verifyToken, blockGuest, controller.getBlockedUsers); //people *I* blocked
router.post("/:id/block", verifyToken, blockGuest, controller.blockUser); //also removes any friendship between us
router.delete("/:id/block", verifyToken, blockGuest, controller.unblockUser);

// someone's posts that I'm allowed to see. e.g. /users/2/posts?cursor=...&limit=20
router.get("/:id/posts", verifyToken, blockGuest, controller.getUserPosts);

module.exports = router;
