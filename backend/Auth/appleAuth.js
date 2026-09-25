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
	} catch (err) {
		throw new UnauthorizedError("Invalid or expired Apple identityToken");
	}
}

module.exports = { verifyAppleIdentityToken };
