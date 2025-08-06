const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
	if (!req.headers.authorization) res.status(401).json({ message: "Missing authorization Token" });
	const accessToken = req.headers.authorization.split(" ")[1];

	//if token is valid: next()
	try {
		const user = jwt.verify(accessToken, process.env.JWT_SECRET, {
			audience: "my-gym-app",
			issuer: "gym-auth-server",
		});
		res.user_id = user.user_id;
		next();
	} catch (err) {
		console.log("Access Token is invalid.");
		console.log("Error: " + err);
		res.status(401).json({ message: "Access Token is invalid" });
	}

	//if accessToken is invalid: attempt to refresh token.
	//if refresh fails, res.send(401)->return to login
	//if refresh succeeds, res.set(new accessToken)->next
}

module.exports = verifyToken;
