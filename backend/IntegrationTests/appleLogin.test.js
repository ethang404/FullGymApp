const request = require("supertest");

//the identityToken string picks which payload Apple "returns", so each test can shape the nonce claims
jest.mock("../Auth/appleAuth", () => {
	const hash = (value) => require("crypto").createHash("sha256").update(value).digest("hex");
	const PAYLOADS = {
		"a-good": { sub: "a-good", nonce: hash("raw-nonce") },
		"a-no-nonce": { sub: "a-no-nonce" },
		"a-unsupported": { sub: "a-unsupported", nonce_supported: false },
		"a-supported-missing": { sub: "a-supported-missing", nonce_supported: true },
	};
	return {
		verifyAppleIdentityToken: jest.fn(async (identityToken) => PAYLOADS[identityToken]),
		exchangeAppleAuthorizationCode: jest.fn(async () => null),
		revokeAppleToken: jest.fn(async () => {}),
	};
});

const sequelize = require("../models/db");
const app = require("../app");

// sync({force:true}) rebuilds every table - extended timeout, same as the other suites
beforeAll(async () => {
	await sequelize.sync({ force: true });
}, 30000);

afterAll(async () => {
	await sequelize.close();
});

const appleLogin = (identityToken, nonce = "raw-nonce") => request(app).post("/auth/apple").send({ identityToken, nonce });

describe("POST /auth/apple nonce check", () => {
	test("matching nonce -> signed in", async () => {
		const resp = await appleLogin("a-good");
		expect(resp.status).toBe(200);
		expect(resp.body.accessToken).toBeDefined();
	});

	test("wrong nonce -> 401", async () => {
		expect((await appleLogin("a-good", "someone-elses-nonce")).status).toBe(401);
	});

	test("token with no nonce -> 401", async () => {
		const resp = await appleLogin("a-no-nonce");
		expect(resp.status).toBe(401);
		expect(resp.body.accessToken).toBeUndefined();
	});

	test("no nonce but nonce_supported true -> 401", async () => {
		expect((await appleLogin("a-supported-missing")).status).toBe(401);
	});

	test("no nonce on a platform that can't do nonces -> signed in, as Apple says", async () => {
		expect((await appleLogin("a-unsupported")).status).toBe(200);
	});
});

describe("usernames for new Apple accounts", () => {
	//each sign-up needs its own Apple user id, and the mock keys payloads by identityToken
	const { verifyAppleIdentityToken } = require("../Auth/appleAuth");
	const hash = (value) => require("crypto").createHash("sha256").update(value).digest("hex");
	const signUp = async (sub, names) => {
		verifyAppleIdentityToken.mockResolvedValueOnce({ sub, nonce: hash("raw-nonce"), email: "john.smith1987@gmail.com" });
		return request(app)
			.post("/auth/apple")
			.send({ identityToken: sub, nonce: "raw-nonce", ...names });
	};

	test("built from their name plus 4 digits, never the email", async () => {
		const resp = await signUp("a-named", { firstName: "John", lastName: "Smith" });
		expect(resp.body.username).toMatch(/^johnsmith\d{4}$/);
	});

	test("no name shared -> user plus 4 digits", async () => {
		const resp = await signUp("a-nameless", {});
		expect(resp.body.username).toMatch(/^user\d{4}$/);
	});

	test("characters outside a-z are dropped, and a name with none left falls back to user", async () => {
		expect((await signUp("a-accents", { firstName: "José", lastName: "Núñez" })).body.username).toMatch(/^josnez\d{4}$/);
		expect((await signUp("a-hanzi", { firstName: "李" })).body.username).toMatch(/^user\d{4}$/);
	});

	test("two people with the same name get different usernames", async () => {
		const first = await signUp("a-twin-1", { firstName: "Sam" });
		const second = await signUp("a-twin-2", { firstName: "Sam" });
		expect(first.body.username).not.toBe(second.body.username);
	});
});
