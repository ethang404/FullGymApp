const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const usersDB = require("../models/modelInits").users;
const { UnauthorizedError, GeneralError, DataError } = require("../error");

async function refreshToken(token) {
	if (!token) throw new DataError("Missing refreshToken for refresh");

	let payload;
	try {
		payload = jwt.verify(token, process.env.JWT_SECRET, {
			audience: "my-gym-app",
			issuer: "gym-auth-server",
		});
	} catch (err) {
		throw new UnauthorizedError("Invalid or expired refresh token");
	}

	if (payload.type !== "refresh") {
		throw new UnauthorizedError("Token provided is not a refresh token");
	}

	const accessToken = jwt.sign({ user_id: payload.user_id, type: "access" }, process.env.JWT_SECRET, {
		expiresIn: "1h",
		audience: "my-gym-app",
		issuer: "gym-auth-server",
	});
	return accessToken;
}

function generateTokens(user_id) {
	const accessToken = jwt.sign({ user_id, type: "access" }, process.env.JWT_SECRET, {
		expiresIn: "1h",
		audience: "my-gym-app",
		issuer: "gym-auth-server",
	});
	const refreshToken = jwt.sign({ user_id, type: "refresh" }, process.env.JWT_SECRET, {
		expiresIn: "30 days",
		audience: "my-gym-app",
		issuer: "gym-auth-server",
	});
	return {
		accessToken,
		refreshToken,
	};
}

async function register(userData) {
	const { firstName, lastName, userName, password } = userData;
	if (!firstName || !lastName || !userName || !password) {
		throw new DataError("Missing required fields for registration");
	}

	const saltRounds = 10;
	const salt = await bcrypt.genSalt(saltRounds);
	const hash = await bcrypt.hash(password + process.env.PEPPER, salt);

	try {
		const user = await usersDB.create({
			first_name: firstName,
			last_name: lastName,
			user_name: userName,
			password: hash,
		});
		return user;
	} catch (err) {
		throw new GeneralError("Failed to register user");
	}
}

async function login(username, password) {
	if (!username || !password) {
		throw new DataError("Missing required fields for username and password");
	}

	const user = await usersDB.findOne({ where: { user_name: username } });

	if (!user) throw new UnauthorizedError("Invalid credentials with provided username and password");

	const fullPass = password + process.env.PEPPER;
	const validPassword = await bcrypt.compare(fullPass, user.password);
	if (!validPassword) throw new UnauthorizedError("Invalid credentials with provided username and password");

	return user;
}

module.exports = { register, refreshToken, login, generateTokens };
