const authService = require("./service");

async function refreshToken(req, res) {
	try {
		const accessToken = await authService.refreshToken(req.body.refreshToken);
		return res.status(200).json({ accessToken, message: "Successfully refreshed access token" });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function register(req, res) {
	try {
		const user = await authService.register(req.body);
		const { accessToken, refreshToken } = authService.generateTokens(user.user_id);

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
		const { accessToken, refreshToken } = authService.generateTokens(user.user_id);

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
	return res.status(200).json({ message: "user is valid" });
}

module.exports = { register, refreshToken, login, IsValidToken };
