const express = require("express");
const router = express.Router();
const validateIdParam = require("../middlewear/validateIdParam");

//numeric route params -> 400 if they aren't a valid id (instead of a postgres 500)
router.param("id", validateIdParam);
router.param("user_id", validateIdParam);

const controller = require("./controller");
const verifyToken = require("../middlewear/token");
const blockGuest = require("../middlewear/checkIsGuest");

//every groups endpoint needs a real (non-guest) account
router.use(verifyToken, blockGuest);

// ---------------------------------------------
// Groups
// ---------------------------------------------
router.get("/mine", controller.getMyGroups); //my active groups + pending invites
router.get("/", controller.searchGroups); //e.g. /groups?search=lifting
router.post("/", controller.createGroup); //body: { name, description?, join_policy? }. Creator becomes owner
router.get("/:id", controller.getGroup);
router.patch("/:id", controller.updateGroup); //owner/admin. body: { name?, description?, join_policy? }
router.delete("/:id", controller.deleteGroup); //owner only. Memberships + posts cascade

// ---------------------------------------------
// Membership
// ---------------------------------------------
// join_policy decides what join does: open -> active, request -> pending, invite_only -> 403
router.post("/:id/join", controller.joinGroup);
router.post("/:id/invites", controller.inviteMember); //body: { user_id }. Creates an "invited" membership
router.post("/:id/invites/accept", controller.acceptInvite); //the invited user accepts their own invite
router.post("/:id/requests/:user_id/approve", controller.approveRequest); //owner/admin approves a "pending" join request

router.get("/:id/members", controller.getMembers);
router.patch("/:id/members/:user_id", controller.updateMemberRole); //owner/admin. body: { role }
// leave (yourself), kick (owner/admin), decline an invite, reject or cancel a join request, unban
// ?ban=true -> owner/admin bans instead (status "banned", can't rejoin)
router.delete("/:id/members/:user_id", controller.removeMember);
router.post("/:id/transfer-ownership", controller.transferOwnership); //owner only. body: { user_id }

// ---------------------------------------------
// Group feed
// ---------------------------------------------
// e.g. /groups/3/posts?cursor=...&limit=20. Queries live in Posts/service.js so every feed is built the same way
router.get("/:id/posts", controller.getGroupPosts);

module.exports = router;
