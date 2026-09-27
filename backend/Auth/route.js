const express = require("express");
const router = express.Router();

//import controller to call endpoint
const authController = require("./controller");

//middlwear
const verifyToken = require("../middlewear/token");

router.post("/register", authController.register);
router.post("/refresh", authController.refreshToken);
router.post("/login", authController.login);
router.post("/guest", authController.createGuest);
router.post("/upgrade-guest", verifyToken, authController.upgradeGuest); //upgrade guest to real account
router.post("/upgrade-guest/oauth", verifyToken, authController.upgradeGuestWithOAuth); //upgrade guest via google/apple (may merge into existing account)
router.get("/validToken", verifyToken, authController.IsValidToken);

//google/apple
router.post("/google", authController.googleLogin);
router.post("/apple", authController.appleLogin);

module.exports = router;
