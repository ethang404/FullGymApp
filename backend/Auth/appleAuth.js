const jwt = require("jsonwebtoken");
const jwkToPem = require("jwk-to-pem");
const { UnauthorizedError } = require("../error");

const JWKS_URI = "https://appleid.apple.com/auth/keys";
const CACHE_MAX_AGE_MS = 60 * 60 * 1000;

// Apple's public signing keys, cached in memory - only re-fetched when a
// `kid` isn't found in the cache (e.g. after Apple rotates keys) or the
// cache has gone stale.
let cachedKeys = null;
let cachedAt = 0;

async function fetchKeys() {
	const res = await fetch(JWKS_URI);
	if (!res.ok) throw new UnauthorizedError("Failed to fetch Apple's signing keys");
	const { keys } = await res.json();
	cachedKeys = keys;
	cachedAt = Date.now();
	return cachedKeys;
}

async function getSigningKey(kid) {
	const isStale = !cachedKeys || Date.now() - cachedAt > CACHE_MAX_AGE_MS;
	let keys = isStale ? await fetchKeys() : cachedKeys;

	let key = keys.find((k) => k.kid === kid);
	if (!key) {
		// kid not found even in a fresh fetch means Apple genuinely doesn't have it.
		key = (await fetchKeys()).find((k) => k.kid === kid);
	}
	if (!key) throw new UnauthorizedError("No matching Apple signing key for this token");

	return jwkToPem(key); //this takes in the n and the e to make some public key thing
}

// Verifies the identityToken's signature/aud/iss/exp against Apple's keys and
// returns the decoded payload. payload.sub is the stable Apple user id.
async function verifyAppleIdentityToken(identityToken) {
	if (!identityToken) throw new UnauthorizedError("Missing Apple identityToken");

	//kid is the public token id from above fetch, gotta match right one to what we have
	const decoded = jwt.decode(identityToken, { complete: true });
	if (!decoded?.header?.kid) throw new UnauthorizedError("Malformed Apple identityToken");

	const publicKey = await getSigningKey(decoded.header.kid);

	try {
		return jwt.verify(identityToken, publicKey, {
			algorithms: ["RS256"],
			audience: process.env.APPLE_BUNDLE_ID, //meant for my app
			issuer: "https://appleid.apple.com",
		});
	} catch {
		throw new UnauthorizedError("Invalid or expired Apple identityToken");
	}
}

// ---------------- Token exchange + revocation ----------------
// Apple requires apps with Sign in with Apple to revoke the user's tokens when they delete their account.
// Revoking needs an Apple refresh token, which we only get by trading the one-time authorizationCode from
// sign-in at /auth/token. Both calls authenticate with a "client secret": a short-lived ES256 JWT signed with
// the Sign in with Apple key (.p8) from the Apple developer portal.

const TOKEN_URL = "https://appleid.apple.com/auth/token";
const REVOKE_URL = "https://appleid.apple.com/auth/revoke";

// Without these (local dev, CI) exchange/revoke are skipped instead of failing sign-in or deletion.
function isAppleTokenApiConfigured() {
	return Boolean(process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY && process.env.APPLE_BUNDLE_ID);
}

function createClientSecret() {
	//.env can't hold real newlines, so the .p8 contents are stored with literal "\n"s
	const privateKey = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n");
	return jwt.sign({}, privateKey, {
		algorithm: "ES256",
		keyid: process.env.APPLE_KEY_ID,
		issuer: process.env.APPLE_TEAM_ID,
		subject: process.env.APPLE_BUNDLE_ID, //native iOS app: the client_id is the bundle id
		audience: "https://appleid.apple.com",
		expiresIn: "5m", //only used for the request it's made for
	});
}

async function postForm(url, fields) {
	return fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ client_id: process.env.APPLE_BUNDLE_ID, client_secret: createClientSecret(), ...fields }),
	});
}

// Trades the authorizationCode from sign-in (single use, valid ~5 minutes) for Apple's refresh token.
// Returns null if it can't (not configured, bad/expired code) - callers treat that as "nothing to store".
async function exchangeAppleAuthorizationCode(authorizationCode) {
	if (!authorizationCode || !isAppleTokenApiConfigured()) return null;

	const res = await postForm(TOKEN_URL, { code: authorizationCode, grant_type: "authorization_code" });
	if (!res.ok) {
		console.error(`Apple token exchange failed (${res.status}): ${await res.text()}`);
		return null;
	}
	const { refresh_token } = await res.json();
	return refresh_token ?? null;
}

// Revokes the refresh token, which also ends the app's link to the user's Apple ID (it disappears from
// "Sign in with Apple" in their Apple ID settings). Returns whether Apple accepted it.
async function revokeAppleToken(refreshToken) {
	if (!refreshToken || !isAppleTokenApiConfigured()) return false;

	const res = await postForm(REVOKE_URL, { token: refreshToken, token_type_hint: "refresh_token" });
	if (!res.ok) console.error(`Apple token revoke failed (${res.status}): ${await res.text()}`);
	return res.ok;
}

module.exports = { verifyAppleIdentityToken, exchangeAppleAuthorizationCode, revokeAppleToken };
