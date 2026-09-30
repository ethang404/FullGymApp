const express = require("express");
const router = express.Router();
const controller = require("./controller");
const verifyToken = require("../middlewear/token");
const blockGuest = require("../middlewear/blockGuest");

// GET    /friends                         list accepted friends
// GET    /friends/requests?direction=...  list pending requests (incoming|outgoing)
// GET    /friends/search?query=&limit=    search users to add, annotated w/ relationship state
// POST   /friends/requests                { addressee_user_id } - send a request
// POST   /friends/requests/:id/accept     accept a pending request (addressee only)
// DELETE /friends/requests/:id            decline (addressee) or cancel (requester) a pending request
// DELETE /friends/:id                     unfriend an accepted friendship

// Guest accounts can't have friends - blocked after auth so we still get a
// clean 403 instead of a confusing empty/broken response.
router.use(verifyToken, blockGuest);

router.get("/", controller.listFriends);
router.get("/requests", controller.listRequests);
router.get("/search", controller.searchUsers);

router.post("/requests", controller.sendRequest);
router.post("/requests/:id/accept", controller.acceptRequest);
router.delete("/requests/:id", controller.deletePendingRequest);

router.delete("/:id", controller.removeFriend);

module.exports = router;
