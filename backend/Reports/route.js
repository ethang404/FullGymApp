const express = require("express");
const router = express.Router();

const controller = require("./controller");
const verifyToken = require("../middlewear/token");

router.use(verifyToken);

// guests can reach this one, the service limits them to reporting foods
router.post("/", controller.createReport); //body: { target_type, target_id, reason, note? }

//the admin side of reports is in Admin/route.js
module.exports = router;
