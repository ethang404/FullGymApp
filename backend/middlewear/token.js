const { users } = require("../models/modelInits");
const { verifyJwt, isRevokedGuestToken, isUserBanned } = require("../Auth/tokens");

async function verifyToken(req, res, next) {
	if (!req.headers.authorization) return res.status(401).json({ message: "Missing authorization Token" });
	const accessToken = req.headers.authorization.split(" ")[1];

	//if token is valid: next()
	let payload;
	try {
		payload = verifyJwt(accessToken);
	} catch (err) {
		console.log("Access Token is invalid.");
		console.log("Error: " + err);
		return res.status(401).json({ message: "Access Token is invalid" });
	}

	//Also check that our given user is valid for this jwt and not banned
	let user;
	try {
		user = await users.findByPk(payload.user_id);
		if (!user || isUserBanned(user)) {
			return res.status(401).json({ message: "User no longer exists" });
		}
		if (isRevokedGuestToken(payload, user)) {
			//if token says we're a guest, but we aren't anymore (upgraded)
			return res.status(401).json({ message: "Guest session has ended, please sign in again" });
		}
	} catch (err) {
		console.log("Failed to verify user exists.");
		console.log("Error: " + err);
		return res.status(500).json({ message: "Failed to verify user" });
	}

	req.user_id = payload.user_id;
	req.is_guest = user.is_guest;
	next();

	//if accessToken is invalid: attempt to refresh token.
	//if refresh fails, res.send(401)->return to login
	//if refresh succeeds, res.set(new accessToken)->next
}

module.exports = verifyToken;
