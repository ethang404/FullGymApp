const express = require("express");
const router = express.Router();
const validateIdParam = require("../middlewear/validateIdParam");

//numeric route params -> 400 if they aren't a valid id (instead of a postgres 500)
router.param("friendship_id", validateIdParam);
router.param("friend_id", validateIdParam);
router.param("workout_id", validateIdParam);
router.param("recipe_id", validateIdParam);

const controller = require("./controller");
const verifyToken = require("../middlewear/token");
const blockGuest = require("../middlewear/checkIsGuest");

//every friends endpoint needs a real (non-guest) account
router.use(verifyToken, blockGuest);

// ---------------------------------------------
// Friend requests
// ---------------------------------------------
router.get("/requests", controller.getRequests); //incoming + outgoing pending requests
router.post("/requests", controller.sendRequest); //body: { user_id }
router.post("/requests/:friendship_id/accept", controller.acceptRequest); //friendship row id (not friend's id) --only the receiver can accept. Creates both permission rows
router.delete("/requests/:friendship_id", controller.deleteRequest); //friendship row id (not friend's id) --decline (receiver) or cancel (sender)

// ---------------------------------------------
// Friends
// ---------------------------------------------
router.get("/", controller.getFriends); //accepted friends (the *other* user) + i_share / they_share permission rows
router.delete("/:friend_id", controller.removeFriend); //unfriend. Permission rows cascade

//Change what we share with a friend
router.patch("/:friend_id/permissions", controller.updatePermissions); //body: { workouts?, recipes?, diary?, goals? }

// ---------------------------------------------
// Viewing a friend's data (read only, gated by THEIR permissions row)
// ---------------------------------------------
router.get("/:friend_id", controller.getFriendOverview); //profile screen: everything they share, bounded. e.g. /friends/2?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD (bounds workouts + diary)
router.get("/:friend_id/workouts/:workout_id", controller.getFriendWorkout); //workout must belong to friend_id
router.get("/:friend_id/recipes/:recipe_id", controller.getFriendRecipe); //recipe must belong to friend_id

module.exports = router;
