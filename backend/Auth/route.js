const express = require("express");
const router = express.Router();

//import controller to call endpoint
const authController = require("./controller");

//middlwear
const verifyToken = require("../Middlewear/token");

router.post("/register", authController.register);
router.post("/refresh", authController.refreshToken);
router.post("/login", authController.login);
router.get("/validToken", verifyToken, authController.IsValidToken);

module.exports = router;
