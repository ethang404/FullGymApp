const authService = require("./service");
const bcrypt = require("bcrypt");

async function test(req, res) {
	console.log("In controller");
	const resp = await authService.test();
	return res.status(200).json({ message: resp });
}

function refreshToken(req, res) {
	//const refreshToken = req.headers.authorization.split(" ")[1];
	const refreshToken = req.body.refreshToken;
	if (!refreshToken) res.status(401).json({ message: "Missing RefreshToken for refresh" });
	try {
		const resp = authService.refreshToken(refreshToken);
		res.status(200).json({ accessToken: resp, message: "Sucessfully refreshed Access Token" });
	} catch (err) {
		res.status(401).json({ message: "Failed to refreshToken. Invalid refreshToken" });
	}
}

async function register(req, res) {
	const saltRounds = 10;
	const salt = await bcrypt.genSalt(saltRounds);
	const hash = await bcrypt.hash(req.body.password + process.env.PEPPER, salt);
	req.body.password = hash;
	try {
		const resp = await authService.register(req.body);
		const { accessToken, refreshToken } = authService.generateTokens(user.user_id);
		res.status(201).json({
			message: "User created!",
			userId: resp.user_id,
			username: resp.user_name,
			accessToken,
			refreshToken,
		});
	} catch (error) {
		console.error("Error during registration:", error);
		res.status(500).json({ message: "Failed to register user" });
	}
}

async function login(req, res) {
	let validPassword;
	let user_id;
	let hashedPassword;
	let user;

	try {
		const { userName, password } = req.body;
		if (!userName || !password) {
			return res.status(400).json({ message: "Missing required fields for username and password" });
		}
		user = await authService.login(userName);
		if (!user)
			res.status(401).json({ message: "Invalid Credentials with provided username and password" });
		let fullPass = password + process.env.PEPPER;

		validPassword = bcrypt.compare(fullPass, user.password); //returns true if valid user. False otherwise
	} catch (error) {}

	if (!validPassword)
		res.status(401).json({ message: "Invalid Credentials with provided username and password" });

	const { accessToken, refreshToken } = authService.generateTokens(user.user_id);
	res.status(200).json({
		message: "Login successful",
		accessToken,
		refreshToken,
	});
}

module.exports = { test, register, refreshToken, login };
