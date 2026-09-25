const authService = require("./service");

async function refreshToken(req, res) {
	try {
		const { accessToken, refreshToken } = await authService.refreshToken(req.body.refreshToken);
		return res.status(200).json({ accessToken, refreshToken, message: "Successfully refreshed access token" });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function register(req, res) {
	try {
		const user = await authService.register(req.body);
		const { accessToken, refreshToken } = authService.generateTokens(user.user_id, user.is_guest);

		return res.status(201).json({
			message: "User created!",
			userId: user.user_id,
			username: user.user_name,
			accessToken,
			refreshToken,
		});
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function login(req, res) {
	try {
		const { userName, password } = req.body;
		const user = await authService.login(userName, password);
		const { accessToken, refreshToken } = authService.generateTokens(user.user_id, user.is_guest);

		return res.status(200).json({
			message: "Login successful",
			accessToken,
			refreshToken,
		});
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function IsValidToken(req, res) {
	return res.status(200).json({ message: "user is valid", isGuest: req.is_guest });
}

async function createGuest(req, res) {
	try {
		const user = await authService.createGuest();
		const { accessToken, refreshToken } = authService.generateTokens(user.user_id, true);

		return res.status(201).json({
			message: "Guest user created!",
			userId: user.user_id,
			accessToken,
			refreshToken,
			isGuest: true,
		});
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function upgradeGuest(req, res) {
	try {
		const user = await authService.upgradeGuest(req.user_id, req.body);
		// user.is_guest is now false - reissue tokens so the old non-expiring
		// guest access token doesn't keep working forever past the upgrade.
		const { accessToken, refreshToken } = authService.generateTokens(user.user_id, false);
		return res.status(200).json({ message: "Account upgraded!", username: user.user_name, accessToken, refreshToken });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

//Functions for OAuth logins
async function googleLogin(req, res) {
	const { idToken } = req.body;

	if (typeof idToken !== "string") {
		return res.status(400).json({ message: "idToken is required" });
	}

	try {
		const result = await authService.loginWithGoogle({ idToken });
		return res.json(result);
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		console.error("googleLogin failed", error);
		return res.status(500).json({ message: "Something went wrong" });
	}
}

async function appleLogin(req, res) {
	const { identityToken, authorizationCode, nonce, firstName, lastName } = req.body;

	if (typeof identityToken !== "string" || typeof nonce !== "string") {
		return res.status(400).json({ message: "identityToken and nonce are required" });
	}

	try {
		const result = await authService.loginWithApple({
			identityToken,
			authorizationCode: typeof authorizationCode === "string" ? authorizationCode : null,
			nonce,
			firstName: firstName ?? null,
			lastName: lastName ?? null,
		});
		return res.json(result);
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		console.error("appleLogin failed", error);
		return res.status(500).json({ message: "Something went wrong" });
	}
}

module.exports = { register, refreshToken, login, IsValidToken, createGuest, upgradeGuest, googleLogin, appleLogin };
