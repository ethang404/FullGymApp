const express = require("express");
const router = express.Router();
const validateIdParam = require("../middlewear/validateIdParam");

//numeric route params -> 400 if they aren't a valid id (instead of a postgres 500)
router.param("id", validateIdParam);
router.param("comment_id", validateIdParam);

const controller = require("./controller");
const verifyToken = require("../middlewear/token");
const blockGuest = require("../middlewear/checkIsGuest");

//every posts endpoint needs a real (non-guest) account
router.use(verifyToken, blockGuest);

// ---------------------------------------------
// Posts
// ---------------------------------------------
// have to put before "/:id" or it will think "public" is an id
router.get("/public", controller.getPublicFeed); //e.g. /posts/public?cursor=...&limit=20
router.post("/", controller.createPost); //body: { visibility, group_id?, workout_id? | recipe_id?, caption? }
router.get("/:id", controller.getPost); //post + its attachment, checked against the post's visibility
router.patch("/:id", controller.updatePost); //author only. body: { caption }
router.delete("/:id", controller.deletePost); //author, or group owner/admin for group posts

// copy a shared recipe (+ ingredients) into my own recipes
router.post("/:id/save-recipe", controller.saveRecipe);

// ---------------------------------------------
// Likes - composite PK makes these idempotent
// ---------------------------------------------
router.post("/:id/like", controller.likePost);
router.delete("/:id/like", controller.unlikePost);

// ---------------------------------------------
// Comments
// ---------------------------------------------
router.get("/:id/comments", controller.getComments); //e.g. /posts/5/comments?cursor=...&limit=20
router.post("/:id/comments", controller.addComment); //body: { body }
router.delete("/:id/comments/:comment_id", controller.deleteComment); //commenter, post author, or group owner/admin

module.exports = router;
