const express = require("express");
const router = express.Router();

//import controller to call endpoint
const authController = require("./controller");

//middlwear
const verifyToken = require("../middlewear/token");

console.log("Are you working?");
router.get("/test", authController.test);
router.post("/register", authController.register);
router.post("/refresh", authController.refreshToken);
router.post("/login", authController.login);
router.get("/validToken", verifyToken, authController.IsValidToken);

module.exports = router;
