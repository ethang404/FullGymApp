const jwt = require("jsonwebtoken");
const { users } = require("../models/modelInits");

async function verifyToken(req, res, next) {
	if (!req.headers.authorization) return res.status(401).json({ message: "Missing authorization Token" });
	const accessToken = req.headers.authorization.split(" ")[1];

	//if token is valid: next()
	let payload;
	try {
		payload = jwt.verify(accessToken, process.env.JWT_SECRET, {
			audience: "my-gym-app",
			issuer: "gym-auth-server",
		});
	} catch (err) {
		console.log("Access Token is invalid.");
		console.log("Error: " + err);
		return res.status(401).json({ message: "Access Token is invalid" });
	}

	//Also check that our given user is valid for this jwt
	try {
		const user = await users.findByPk(payload.user_id);
		if (!user) {
			return res.status(401).json({ message: "User no longer exists" });
		}
	} catch (err) {
		console.log("Failed to verify user exists.");
		console.log("Error: " + err);
		return res.status(500).json({ message: "Failed to verify user" });
	}

	res.user_id = payload.user_id;
	next();

	//if accessToken is invalid: attempt to refresh token.
	//if refresh fails, res.send(401)->return to login
	//if refresh succeeds, res.set(new accessToken)->next
}

module.exports = verifyToken;
