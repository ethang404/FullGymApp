const express = require("express");
const router = express.Router();

//import controller to call endpoint
const authController = require("./controller");

console.log("Are you working?");
router.get("/test", authController.test);
router.post("/register", authController.register);
router.post("/refresh", authController.refreshToken);
router.post("/login", authController.login);

module.exports = router;
