const express = require("express");
const router = express.Router();
const controller = require("./controller");
const verifyToken = require("../Middlewear/token");

// GET /explore?type=recipe|workout|all&scope=all|friends|public|mine&search=&cursor=&limit=20
// Combined, cursor-paginated feed of recipes + workouts the caller is allowed to see:
//   scope=all     (default) own content (any visibility) + public + friends' friends-visible content
//   scope=mine    only the caller's own content
//   scope=public  public content from anyone
//   scope=friends only friends-visible content from accepted friends
router.get("/", verifyToken, controller.getExploreFeed);

module.exports = router;
