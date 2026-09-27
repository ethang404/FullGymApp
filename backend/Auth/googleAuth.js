const { OAuth2Client } = require("google-auth-library");
const { UnauthorizedError } = require("../error");

const client = new OAuth2Client();

// The idToken's `aud` claim is whichever client ID (web or iOS) the frontend
// configured GoogleOneTapSignIn with - accept either since one app has both.
const ACCEPTED_AUDIENCES = [process.env.GOOGLE_WEB_CLIENT_ID, process.env.GOOGLE_IOS_CLIENT_ID].filter(Boolean);

// Verifies the idToken's signature/aud/iss/exp against Google's keys and
// returns the decoded payload. payload.sub is the stable Google user id.
async function verifyGoogleIdToken(idToken) {
	if (!idToken) throw new UnauthorizedError("Missing Google idToken");

	let ticket;
	try {
		ticket = await client.verifyIdToken({
			idToken,
			audience: ACCEPTED_AUDIENCES,
		});
	} catch (err) {
		throw new UnauthorizedError("Invalid or expired Google idToken");
	}

	return ticket.getPayload();
}

module.exports = { verifyGoogleIdToken };
