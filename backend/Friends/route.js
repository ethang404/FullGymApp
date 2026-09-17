const express = require("express");
const router = express.Router();
const controller = require("./controller");
const verifyToken = require("../Middlewear/token");

// GET    /friends                         list accepted friends
// GET    /friends/requests?direction=...  list pending requests (incoming|outgoing)
// GET    /friends/search?query=&limit=    search users to add, annotated w/ relationship state
// POST   /friends/requests                { addressee_user_id } - send a request
// POST   /friends/requests/:id/accept     accept a pending request (addressee only)
// DELETE /friends/requests/:id            decline (addressee) or cancel (requester) a pending request
// DELETE /friends/:id                     unfriend an accepted friendship

router.get("/", verifyToken, controller.listFriends);
router.get("/requests", verifyToken, controller.listRequests);
router.get("/search", verifyToken, controller.searchUsers);

router.post("/requests", verifyToken, controller.sendRequest);
router.post("/requests/:id/accept", verifyToken, controller.acceptRequest);
router.delete("/requests/:id", verifyToken, controller.deletePendingRequest);

router.delete("/:id", verifyToken, controller.removeFriend);

module.exports = router;
