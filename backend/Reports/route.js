const express = require("express");
const router = express.Router();
const validateIdParam = require("../middlewear/validateIdParam");

//numeric route params -> 400 if they aren't a valid id (instead of a postgres 500)
router.param("id", validateIdParam);

const controller = require("./controller");
const verifyToken = require("../middlewear/token");

router.use(verifyToken);

// guests can reach this one, the service limits them to reporting foods
router.post("/", controller.createReport); //body: { target_type, target_id, reason, note? }

module.exports = router;
