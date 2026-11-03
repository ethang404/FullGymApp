const jwt = require("jsonwebtoken");

//every token we sign or verify uses these. Access vs refresh is told apart by payload.type
const JWT_OPTIONS = { audience: "my-gym-app", issuer: "gym-auth-server" };

function generateTokens(user_id, isGuest = false) {
	const accessOptions = { ...JWT_OPTIONS };
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
		...JWT_OPTIONS,
		expiresIn: "30 days",
	});
	return {
		accessToken,
		refreshToken,
	};
}

//returns the payload, throws if the signature, expiry, audience or issuer is wrong
function verifyJwt(token) {
	return jwt.verify(token, process.env.JWT_SECRET, JWT_OPTIONS);
}

//if token says we're a guest, but we aren't anymore (upgraded)
function isRevokedGuestToken(payload, user) {
	return payload.guest === true && !user.is_guest;
}

module.exports = { generateTokens, verifyJwt, isRevokedGuestToken };
