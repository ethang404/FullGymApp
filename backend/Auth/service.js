const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const { Op } = require("sequelize");
const sequelize = require("../models/db");
const {
	users: usersDB,
	workouts: workoutsDB,
	diaryEntries: diaryEntriesDB,
	recipe: recipeDB,
	food: foodDB,
	friendships: friendshipsDB,
} = require("../models/modelInits");
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
	} catch {
		throw new UnauthorizedError("Invalid or expired refresh token");
	}

	if (payload.type !== "refresh") {
		throw new UnauthorizedError("Token provided is not a refresh token");
	}

	const user = await usersDB.findByPk(payload.user_id);
	if (!user) throw new UnauthorizedError("User no longer exists");
	if (isRevokedGuestToken(payload, user)) throw new UnauthorizedError("Guest session has ended, please sign in again");

	// Sliding refresh - every successful refresh also reissues the refresh
	// token itself, so an actively-used account's 30-day window never lapses.
	return generateTokens(user.user_id, user.is_guest);
}

//if token says we're a guest, but we aren't anymore (upgraded)
function isRevokedGuestToken(payload, user) {
	return payload.guest === true && !user.is_guest;
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

	// Guest tokens are stamped so they stop working once the account is upgraded
	// (see isRevokedGuestToken) - otherwise the non-expiring guest access token
	// would keep working for the now-real account forever.
	const guestClaim = isGuest ? { guest: true } : {};

	const accessToken = jwt.sign({ user_id, type: "access", ...guestClaim }, process.env.JWT_SECRET, accessOptions);
	const refreshToken = jwt.sign({ user_id, type: "refresh", ...guestClaim }, process.env.JWT_SECRET, {
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
	} catch {
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
	} catch {
		throw new GeneralError("Failed to create guest user");
	}
}

//default upgrade guest (w/o OAuth)
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

async function loginWithApple({ identityToken, nonce, firstName, lastName }) {
	if (!identityToken) throw new DataError("Missing Apple identityToken");

	const payload = await verifyAppleIdentityToken(identityToken);
	checkAppleNonce(payload, nonce);

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
		} catch {
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
		} catch {
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

//frontend computes a nonce and sends to apple, returned in token val
//backend compares nonce frontend sends to it, vs what apple returns
//so no re-use of token
function checkAppleNonce(payload, nonce) {
	if (!payload.nonce) return;
	const hashedNonce = crypto
		.createHash("sha256")
		.update(nonce || "")
		.digest("hex");
	if (payload.nonce !== hashedNonce) {
		throw new UnauthorizedError("Apple nonce mismatch");
	}
}

// Verifies a Google/Apple token and returns the same shape for either provider
// column = which users column holds this provider's id. (Apple vs google)
async function verifyOAuthIdentity(provider, body) {
	if (provider === "google") {
		if (typeof body.idToken !== "string") throw new DataError("Missing Google idToken");
		const payload = await verifyGoogleIdToken(body.idToken);
		return {
			column: "google_user_id",
			providerId: payload.sub,
			email: payload.email || null,
			firstName: payload.given_name || null,
			lastName: payload.family_name || null,
		};
	}

	if (provider === "apple") {
		if (typeof body.identityToken !== "string") throw new DataError("Missing Apple identityToken");
		const payload = await verifyAppleIdentityToken(body.identityToken);
		checkAppleNonce(payload, body.nonce);
		// Apple only sends the name on the very first authorization, and only to
		// the client - so it comes from the body, not the token.
		return {
			column: "apple_user_id",
			providerId: payload.sub,
			email: payload.email || null,
			firstName: body.firstName || null,
			lastName: body.lastName || null,
		};
	}

	throw new DataError("provider must be 'google' or 'apple'");
}

//2 cases.
//1) User upgrades from guest, and doesn't have an existing apple/google account with us
//--attach the provider id to the guest row and flip is_guest. Same user_id, so all data stays put.
//2) User upgrades from guest, has existing apple/google account with us
//--first call returns requiresConfirm + counts. Frontend asks the user, then resends
//  the same body with confirmed: true, and we move guest data onto that account.
//
//Returns { status: "upgraded" | "merged", user } or { status: "requiresConfirm", counts }.
async function upgradeGuestWithOAuth(guestId, body) {
	const identity = await verifyOAuthIdentity(body.provider, body);

	const guest = await usersDB.findByPk(guestId);
	if (!guest) throw new UnauthorizedError("User no longer exists");
	if (!guest.is_guest) throw new ForbiddenError("Only guest accounts can be upgraded");

	const existing = await usersDB.findOne({ where: { [identity.column]: identity.providerId } });

	// Case 1 - no account for this provider id yet: give guest account this data from google
	if (!existing) {
		const usernameBase = identity.email ? identity.email.split("@")[0] : identity.firstName ? `${identity.firstName}${identity.lastName || ""}` : "user";

		guest[identity.column] = identity.providerId;
		guest.email = identity.email;
		guest.first_name = identity.firstName;
		guest.last_name = identity.lastName;
		guest.user_name = await generateUniqueUsername(usernameBase);
		guest.is_guest = false;
		await guest.save();

		return { status: "upgraded", user: guest };
	}

	// Case 2 - account already exists: merge guest data into it.
	// Nothing to lose if the guest has no data, so skip the prompt in that case.
	const counts = await countUserData(guest.user_id);
	const hasData = Object.values(counts).some((n) => n > 0);
	if (hasData && body.confirmed !== true) {
		return { status: "requiresConfirm", counts }; //if we have data, ask to confirm
	}

	await mergeUserInto(guest.user_id, existing.user_id);
	return { status: "merged", user: existing };
}

// What the user sees in the "bring over your data?" prompt. Counts number of data to transfer
async function countUserData(user_id) {
	const [workouts, diaryEntries, recipes] = await Promise.all([
		workoutsDB.count({ where: { user_id } }),
		diaryEntriesDB.count({ where: { user_id } }),
		recipeDB.count({ where: { user_id } }),
	]);
	return { workouts, diaryEntries, recipes };
}

// Re-points everything fromId owns at toId, then deletes fromId. (worouts/recipes etc.)
// Child rows (exercises/sets, recipe ingredients) follow their parent automatically.
async function mergeUserInto(fromId, toId) {
	await sequelize.transaction(async (t) => {
		await workoutsDB.update({ user_id: toId }, { where: { user_id: fromId }, transaction: t });
		await diaryEntriesDB.update({ user_id: toId }, { where: { user_id: fromId }, transaction: t });
		await recipeDB.update({ user_id: toId }, { where: { user_id: fromId }, transaction: t });
		await foodDB.update({ submitted_by: toId }, { where: { submitted_by: fromId }, transaction: t });

		// Guests are blocked from Friends so there shouldn't be any, but clear them in case
		await friendshipsDB.destroy({
			where: { [Op.or]: [{ user_id_a: fromId }, { user_id_b: fromId }, { requested_by: fromId }] },
			transaction: t,
		});

		await usersDB.destroy({ where: { user_id: fromId }, transaction: t });
	});
}

//Generate random password for OAuth ppl
async function generateUnusablePassword() {
	const saltRounds = 10;
	const salt = await bcrypt.genSalt(saltRounds);
	const randomPassword = crypto.randomBytes(24).toString("hex");
	return bcrypt.hash(randomPassword + process.env.PEPPER, salt);
}

module.exports = {
	register,
	refreshToken,
	login,
	generateTokens,
	isRevokedGuestToken,
	createGuest,
	upgradeGuest,
	upgradeGuestWithOAuth,
	loginWithApple,
	loginWithGoogle,
};
