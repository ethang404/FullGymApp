const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const usersDB = require("../models/modelInits").users;
const { UnauthorizedError, GeneralError, DataError, ForbiddenError } = require("../error");
const { verifyAppleIdentityToken } = require("./appleAuth");
const { verifyGoogleIdToken } = require("./googleAuth");

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

	const user = await usersDB.findByPk(payload.user_id);
	if (!user) throw new UnauthorizedError("User no longer exists");

	// Sliding refresh - every successful refresh also reissues the refresh
	// token itself, so an actively-used account's 30-day window never lapses.
	return generateTokens(user.user_id, user.is_guest);
}

function generateTokens(user_id, isGuest = false) {
	const accessOptions = {
		audience: "my-gym-app",
		issuer: "gym-auth-server",
	};
	// Guests have no username/password to log back in with, so an expired
	// access token with a lapsed refresh token means permanently losing the
	// account. So make infinite
	if (!isGuest) {
		accessOptions.expiresIn = "1h";
	}

	const accessToken = jwt.sign({ user_id, type: "access" }, process.env.JWT_SECRET, accessOptions);
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

async function createGuest() {
	const saltRounds = 10;
	const salt = await bcrypt.genSalt(saltRounds);
	const randomPassword = crypto.randomBytes(24).toString("hex");
	const hash = await bcrypt.hash(randomPassword + process.env.PEPPER, salt);

	try {
		const user = await usersDB.create({
			first_name: "Guest",
			user_name: `guest_${crypto.randomUUID()}`,
			password: hash,
			is_guest: true,
		});
		return user;
	} catch (err) {
		throw new GeneralError("Failed to create guest user");
	}
}

async function upgradeGuest(user_id, userData) {
	const { firstName, lastName, userName, password } = userData;
	if (!firstName || !lastName || !userName || !password) {
		throw new DataError("Missing required fields for registration");
	}

	const user = await usersDB.findByPk(user_id);
	if (!user) throw new UnauthorizedError("User no longer exists");
	if (!user.is_guest) throw new ForbiddenError("Only guest accounts can be upgraded");

	const existing = await usersDB.findOne({ where: { user_name: userName } });
	if (existing) throw new DataError("Username is already taken");

	const saltRounds = 10;
	const salt = await bcrypt.genSalt(saltRounds);
	const hash = await bcrypt.hash(password + process.env.PEPPER, salt);

	user.first_name = firstName;
	user.last_name = lastName;
	user.user_name = userName;
	user.password = hash;
	user.is_guest = false;
	await user.save();

	return user;
}

async function loginWithApple({ identityToken, authorizationCode, nonce, firstName, lastName }) {
	if (!identityToken) throw new DataError("Missing Apple identityToken");

	const payload = await verifyAppleIdentityToken(identityToken);

	//frontend computes a nonce and sends to apple, returned in token val
	//backend compares nonce frontend sends to it, vs what apple returns
	//so no re-use of token
	if (payload.nonce) {
		const hashedNonce = crypto
			.createHash("sha256")
			.update(nonce || "")
			.digest("hex");
		if (payload.nonce !== hashedNonce) {
			throw new UnauthorizedError("Apple nonce mismatch");
		}
	}

	const appleUserId = payload.sub;
	let user = await usersDB.findOne({ where: { apple_user_id: appleUserId } });

	if (!user) {
		const usernameBase = payload.email ? payload.email.split("@")[0] : firstName ? `${firstName}${lastName || ""}` : "apple_user";

		try {
			user = await usersDB.create({
				first_name: firstName || null,
				last_name: lastName || null,
				user_name: await generateUniqueUsername(usernameBase),
				password: await generateUnusablePassword(),
				email: payload.email || null,
				apple_user_id: appleUserId,
			});
		} catch (err) {
			throw new GeneralError("Failed to create user from Apple sign-in");
		}
	}

	return {
		message: "Apple sign-in successful",
		userId: user.user_id,
		username: user.user_name,
		...generateTokens(user.user_id, user.is_guest),
	};
}

// Unlike Apple, Google resends the full profile on every login (not just the
// first), so this always trusts the verified payload directly - no need to
// lean on request-body fields for name/email the way loginWithApple does.
async function loginWithGoogle({ idToken }) {
	if (!idToken) throw new DataError("Missing Google idToken");

	const payload = await verifyGoogleIdToken(idToken);
	const googleUserId = payload.sub;

	let user = await usersDB.findOne({ where: { google_user_id: googleUserId } });

	if (!user) {
		const usernameBase = payload.email ? payload.email.split("@")[0] : payload.given_name ? `${payload.given_name}${payload.family_name || ""}` : "google_user";

		try {
			user = await usersDB.create({
				first_name: payload.given_name || null,
				last_name: payload.family_name || null,
				user_name: await generateUniqueUsername(usernameBase),
				password: await generateUnusablePassword(),
				email: payload.email || null,
				google_user_id: googleUserId,
			});
		} catch (err) {
			throw new GeneralError("Failed to create user from Google sign-in");
		}
	}

	return {
		message: "Google sign-in successful",
		userId: user.user_id,
		username: user.user_name,
		...generateTokens(user.user_id, user.is_guest),
	};
}

// OAuth random username
async function generateUniqueUsername(base) {
	const sanitizedBase =
		(base || "user")
			.toLowerCase()
			.replace(/[^a-z0-9_]/g, "")
			.slice(0, 20) || "user";

	let candidate = sanitizedBase;
	let attempts = 0;
	while (await usersDB.findOne({ where: { user_name: candidate } })) {
		attempts += 1;
		if (attempts > 10) throw new GeneralError("Failed to generate a unique username");
		candidate = `${sanitizedBase}${crypto.randomInt(1000, 9999)}`;
	}
	return candidate;
}

//Generate random password for OAuth ppl
async function generateUnusablePassword() {
	const saltRounds = 10;
	const salt = await bcrypt.genSalt(saltRounds);
	const randomPassword = crypto.randomBytes(24).toString("hex");
	return bcrypt.hash(randomPassword + process.env.PEPPER, salt);
}

module.exports = { register, refreshToken, login, generateTokens, createGuest, upgradeGuest, loginWithApple, loginWithGoogle };
