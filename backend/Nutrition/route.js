const express = require("express");
const router = express.Router();

//import middlwear
const verifyToken = require("../middlewear/token");

//router.get("/protected",)

router.get("/protected", verifyToken, (req, res) => {
	res.send("Birds home page");
});

module.exports = router;
