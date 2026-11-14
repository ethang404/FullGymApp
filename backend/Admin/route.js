const express = require("express");
const router = express.Router();
const validateIdParam = require("../middlewear/validateIdParam");

//numeric route params -> 400 if they aren't a valid id (instead of a postgres 500)
router.param("id", validateIdParam);

const reportsController = require("../Reports/controller");
const usersController = require("../Users/controller");
const verifyToken = require("../middlewear/token");
const requireAdmin = require("../middlewear/requireAdmin");

//verify we're good user and admin
router.use(verifyToken, requireAdmin);

// ---------------------------------------------
// Reports
// ---------------------------------------------
router.get("/reports", reportsController.getReports); //e.g. /admin/reports?status=open&reported_user_id=5&cursor=...&limit=20
router.patch("/reports/:id", reportsController.resolveReport); //body: { status }
router.post("/reports/:id/remove-target", reportsController.removeTarget); //takes the content down + closes its reports

// ---------------------------------------------
// Users
// ---------------------------------------------
router.patch("/users/:id", usersController.setBanned); //body: { is_banned }. true bans, false unbans

module.exports = router;
