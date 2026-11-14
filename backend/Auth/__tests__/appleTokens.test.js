const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { exchangeAppleAuthorizationCode, revokeAppleToken } = require("../appleAuth");

// A throwaway P-256 key standing in for the Sign in with Apple .p8, so the client secret can be checked
// against its public half. fetch is mocked: nothing here talks to Apple.
const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" });

const ENV = {
	APPLE_TEAM_ID: "TEAM123456",
	APPLE_KEY_ID: "KEY1234567",
	APPLE_BUNDLE_ID: "com.ethangordon.hearty",
	APPLE_PRIVATE_KEY: pem.replace(/\n/g, "\\n"), //stored on one line in .env, like the real one
};

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

beforeEach(() => {
	Object.assign(process.env, ENV);
	global.fetch = jest.fn();
});

afterEach(() => {
	process.env = { ...originalEnv };
	global.fetch = originalFetch;
});

const okJson = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
const sentForm = () => new URLSearchParams(global.fetch.mock.calls[0][1].body);

// The client secret Apple expects: ES256, kid = key id, iss = team, sub = bundle id, aud = appleid.apple.com
function expectValidClientSecret(secret) {
	const decoded = jwt.decode(secret, { complete: true });
	expect(decoded.header).toMatchObject({ alg: "ES256", kid: ENV.APPLE_KEY_ID });
	const claims = jwt.verify(secret, publicKey, { algorithms: ["ES256"], audience: "https://appleid.apple.com", issuer: ENV.APPLE_TEAM_ID });
	expect(claims.sub).toBe(ENV.APPLE_BUNDLE_ID);
	expect(claims.exp - claims.iat).toBeLessThanOrEqual(300);
}

describe("exchangeAppleAuthorizationCode", () => {
	test("trades the code for a refresh token with a signed client secret", async () => {
		global.fetch.mockResolvedValue(okJson({ refresh_token: "r.apple.123", access_token: "a" }));

		await expect(exchangeAppleAuthorizationCode("code-abc")).resolves.toBe("r.apple.123");

		expect(global.fetch.mock.calls[0][0]).toBe("https://appleid.apple.com/auth/token");
		const form = sentForm();
		expect(form.get("client_id")).toBe(ENV.APPLE_BUNDLE_ID);
		expect(form.get("code")).toBe("code-abc");
		expect(form.get("grant_type")).toBe("authorization_code");
		expectValidClientSecret(form.get("client_secret"));
	});

	test("returns null when Apple rejects the code", async () => {
		global.fetch.mockResolvedValue({ ok: false, status: 400, text: async () => '{"error":"invalid_grant"}' });
		jest.spyOn(console, "error").mockImplementation(() => {});

		await expect(exchangeAppleAuthorizationCode("expired")).resolves.toBeNull();
	});

	test("skips the call with no code, or when the Apple key isn't configured", async () => {
		await expect(exchangeAppleAuthorizationCode(null)).resolves.toBeNull();

		delete process.env.APPLE_PRIVATE_KEY;
		await expect(exchangeAppleAuthorizationCode("code-abc")).resolves.toBeNull();

		expect(global.fetch).not.toHaveBeenCalled();
	});
});

describe("revokeAppleToken", () => {
	test("revokes the refresh token", async () => {
		global.fetch.mockResolvedValue({ ok: true, status: 200, text: async () => "" });

		await expect(revokeAppleToken("r.apple.123")).resolves.toBe(true);

		expect(global.fetch.mock.calls[0][0]).toBe("https://appleid.apple.com/auth/revoke");
		const form = sentForm();
		expect(form.get("token")).toBe("r.apple.123");
		expect(form.get("token_type_hint")).toBe("refresh_token");
		expectValidClientSecret(form.get("client_secret"));
	});

	test("reports failure instead of throwing", async () => {
		global.fetch.mockResolvedValue({ ok: false, status: 400, text: async () => '{"error":"invalid_client"}' });
		jest.spyOn(console, "error").mockImplementation(() => {});

		await expect(revokeAppleToken("r.apple.123")).resolves.toBe(false);
	});

	test("does nothing without a token", async () => {
		await expect(revokeAppleToken(null)).resolves.toBe(false);
		expect(global.fetch).not.toHaveBeenCalled();
	});
});
