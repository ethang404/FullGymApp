/**
 * Quick manual test: fetch a Kroger OAuth2 token, then look up one product
 * and print the raw response so you can inspect its actual shape
 * (nutritionInformation in particular) before trusting ImportKroger.js's
 * assumptions about it.
 *
 * Usage:
 *   node testKrogerApi.js
 *   node testKrogerApi.js "peanut butter"   // optional search term, default "milk"
 */

require("dotenv").config({ path: "../.env" });

const KROGER_BASE_URL = "https://api.kroger.com/v1";

const searchTerm = process.argv[2] || "milk";

async function getAccessToken() {
	const clientId = process.env.KROGER_CLIENT_ID;
	const clientSecret = process.env.KROGER_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw new Error("KROGER_CLIENT_ID / KROGER_CLIENT_SECRET are not set in .env");
	}

	const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
	const res = await fetch(`${KROGER_BASE_URL}/connect/oauth2/token`, {
		method: "POST",
		headers: {
			Authorization: `Basic ${basicAuth}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: "grant_type=client_credentials&scope=product.compact",
	});

	const payload = await res.json();
	if (!res.ok) {
		throw new Error(`Token request failed: HTTP ${res.status} - ${JSON.stringify(payload)}`);
	}

	console.log("Got token:", payload.access_token.slice(0, 12) + "...", `(expires in ${payload.expires_in}s)`);
	return payload.access_token;
}

async function main() {
	const token = await getAccessToken();

	const query = new URLSearchParams({
		"filter.term": searchTerm,
		"filter.limit": "1",
	});

	const res = await fetch(`${KROGER_BASE_URL}/products?${query.toString()}`, {
		headers: { Authorization: `Bearer ${token}` },
	});

	const payload = await res.json();
	if (!res.ok) {
		throw new Error(`Product search failed: HTTP ${res.status} - ${JSON.stringify(payload)}`);
	}

	console.log(`\n=== Search result for "${searchTerm}" ===\n`);
	console.log(JSON.stringify(payload, null, 2));
}

main().catch((err) => {
	console.error("Test failed:", err);
	process.exit(1);
});
