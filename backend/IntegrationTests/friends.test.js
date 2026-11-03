const request = require("supertest");
const sequelize = require("../models/db");
const { friend_permissions: FriendPermissionsModel, blocked_users: BlockedModel } = require("../models/modelInits");
const { app, registerUser, createGuest, bearer, createWorkout, createRecipe, makeFriends } = require("./SocialHelpers");

// sync({force:true}) rebuilds every table - extended timeout, same as the other suites
beforeAll(async () => {
	await sequelize.sync({ force: true });
}, 30000);

afterAll(async () => {
	await sequelize.close();
});

const sendRequest = (from, to) => request(app).post("/friends/requests").set(bearer(from)).send({ user_id: to.id });

// ─────────────────────────────────────────────
// Friend requests
// ─────────────────────────────────────────────

describe("Friend requests", () => {
	test("requires auth", async () => {
		const resp = await request(app).get("/friends/requests");
		expect(resp.status).toBe(401);
	});

	test("guests can't use friends", async () => {
		const guest = await createGuest();
		const resp = await request(app).get("/friends").set(bearer(guest));
		expect(resp.status).toBe(403);
	});

	test("send -> shows as outgoing for me and incoming for them, with the other user's public fields only", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");

		const resp = await sendRequest(alice, bob);
		expect(resp.status).toBe(201);
		expect(resp.body.request.status).toBe("pending");
		expect(resp.body.request.requested_by).toBe(alice.id);

		const mine = await request(app).get("/friends/requests").set(bearer(alice));
		expect(mine.body.requests.outgoing).toHaveLength(1);
		expect(mine.body.requests.incoming).toHaveLength(0);
		expect(mine.body.requests.outgoing[0].user.user_id).toBe(bob.id);
		expect(mine.body.requests.outgoing[0].user.password).toBeUndefined();

		const theirs = await request(app).get("/friends/requests").set(bearer(bob));
		expect(theirs.body.requests.incoming).toHaveLength(1);
		expect(theirs.body.requests.incoming[0].user.user_id).toBe(alice.id);
	});

	test("request to yourself -> 400", async () => {
		const alice = await registerUser("alice");
		const resp = await sendRequest(alice, alice);
		expect(resp.status).toBe(400);
	});

	test("request to a user that doesn't exist -> 404", async () => {
		const alice = await registerUser("alice");
		const resp = await request(app).post("/friends/requests").set(bearer(alice)).send({ user_id: 999999 });
		expect(resp.status).toBe(404);
	});

	test("request to a guest -> 404", async () => {
		const alice = await registerUser("alice");
		const guest = await createGuest();
		const resp = await sendRequest(alice, guest);
		expect(resp.status).toBe(404);
	});

	test("duplicate request -> 409", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		await sendRequest(alice, bob);
		const resp = await sendRequest(alice, bob);
		expect(resp.status).toBe(409);
	});

	test("sending one back to someone who already asked you auto-accepts", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		await sendRequest(alice, bob);

		const resp = await sendRequest(bob, alice);
		expect(resp.status).toBe(201);
		expect(resp.body.request.status).toBe("accepted");
	});

	test("the sender can't accept their own request -> 403", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		const sent = await sendRequest(alice, bob);

		const resp = await request(app).post(`/friends/requests/${sent.body.request.id}/accept`).set(bearer(alice));
		expect(resp.status).toBe(403);
	});

	test("someone outside the request can't accept it -> 404", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		const eve = await registerUser("eve");
		const sent = await sendRequest(alice, bob);

		const resp = await request(app).post(`/friends/requests/${sent.body.request.id}/accept`).set(bearer(eve));
		expect(resp.status).toBe(404);
	});

	test("accepting creates exactly two permission rows with the default values", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		const sent = await sendRequest(alice, bob);

		const resp = await request(app).post(`/friends/requests/${sent.body.request.id}/accept`).set(bearer(bob));
		expect(resp.status).toBe(200);

		const rows = await FriendPermissionsModel.findAll({ where: { friendship_id: sent.body.request.id } });
		expect(rows).toHaveLength(2);
		expect(rows.map((r) => r.owner_id).sort()).toEqual([alice.id, bob.id].sort());
		for (const row of rows) {
			expect(row.workouts).toBe(true);
			expect(row.recipes).toBe(true);
			expect(row.diary).toBe(false);
			expect(row.goals).toBe(false);
		}
	});

	test("receiver declines -> row is gone, a new request can be sent", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		const sent = await sendRequest(alice, bob);

		const resp = await request(app).delete(`/friends/requests/${sent.body.request.id}`).set(bearer(bob));
		expect(resp.status).toBe(200);

		const again = await sendRequest(alice, bob);
		expect(again.status).toBe(201);
	});

	test("sender cancels -> request disappears for both", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		const sent = await sendRequest(alice, bob);

		await request(app).delete(`/friends/requests/${sent.body.request.id}`).set(bearer(alice));
		const theirs = await request(app).get("/friends/requests").set(bearer(bob));
		expect(theirs.body.requests.incoming).toHaveLength(0);
	});

	test("deleting an accepted friendship through the request route -> 409", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		const sent = await sendRequest(alice, bob);
		await request(app).post(`/friends/requests/${sent.body.request.id}/accept`).set(bearer(bob));

		const resp = await request(app).delete(`/friends/requests/${sent.body.request.id}`).set(bearer(alice));
		expect(resp.status).toBe(409);
	});

	test("can't send a request to someone you're blocked with (either direction) -> 403", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		await BlockedModel.create({ blocker_id: bob.id, blocked_user_id: alice.id });

		expect((await sendRequest(alice, bob)).status).toBe(403);
		expect((await sendRequest(bob, alice)).status).toBe(403);
	});
});

// ─────────────────────────────────────────────
// Friends list + unfriend
// ─────────────────────────────────────────────

describe("Friends list", () => {
	test("lists the other user plus what each side shares", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		await makeFriends(alice, bob);

		const resp = await request(app).get("/friends").set(bearer(alice));
		expect(resp.status).toBe(200);
		expect(resp.body.friends).toHaveLength(1);

		const friend = resp.body.friends[0];
		expect(friend.user_id).toBe(bob.id);
		expect(friend.i_share.owner_id).toBe(alice.id);
		expect(friend.they_share.owner_id).toBe(bob.id);
		expect(friend.password).toBeUndefined();
	});

	test("pending requests aren't in the friends list", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		await sendRequest(alice, bob);

		const resp = await request(app).get("/friends").set(bearer(alice));
		expect(resp.body.friends).toHaveLength(0);
	});

	test("unfriend removes the friendship and both permission rows", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		await makeFriends(alice, bob);

		const resp = await request(app).delete(`/friends/${bob.id}`).set(bearer(alice));
		expect(resp.status).toBe(200);

		const list = await request(app).get("/friends").set(bearer(bob));
		expect(list.body.friends).toHaveLength(0);
		expect(await FriendPermissionsModel.count({ where: { owner_id: [alice.id, bob.id] } })).toBe(0);
	});

	test("unfriending someone you're not friends with -> 404", async () => {
		const alice = await registerUser("alice");
		const bob = await registerUser("bob");
		const resp = await request(app).delete(`/friends/${bob.id}`).set(bearer(alice));
		expect(resp.status).toBe(404);
	});
});

// ─────────────────────────────────────────────
// Permissions + viewing a friend's data
// ─────────────────────────────────────────────

describe("Friend permissions + viewing friend data", () => {
	let alice;
	let bob;
	let stranger;
	let bob_workout;
	let bob_recipe;

	beforeAll(async () => {
		alice = await registerUser("alice");
		bob = await registerUser("bob");
		stranger = await registerUser("stranger");
		await makeFriends(alice, bob);
		bob_workout = await createWorkout(bob);
		bob_recipe = await createRecipe(bob);
	});

	test("PATCH only changes MY row, and ignores unknown/non-boolean fields", async () => {
		const resp = await request(app)
			.patch(`/friends/${bob.id}/permissions`)
			.set(bearer(alice))
			.send({ diary: true, goals: "yes", owner_id: bob.id });
		expect(resp.status).toBe(200);
		expect(resp.body.permissions.owner_id).toBe(alice.id);
		expect(resp.body.permissions.diary).toBe(true);
		expect(resp.body.permissions.goals).toBe(false);

		//bob's row (what bob shares with alice) is untouched
		const list = await request(app).get("/friends").set(bearer(alice));
		expect(list.body.friends[0].they_share.diary).toBe(false);
	});

	test("overview needs a start_date -> 400", async () => {
		const resp = await request(app).get(`/friends/${bob.id}`).set(bearer(alice));
		expect(resp.status).toBe(400);
	});

	test("overview: default sharing shows workouts + recipes, hides diary + goals, never body metrics", async () => {
		const resp = await request(app).get(`/friends/${bob.id}?start_date=2026-09-01&end_date=2026-10-31`).set(bearer(alice));
		expect(resp.status).toBe(200);

		const friend = resp.body.friend;
		expect(friend.user).toEqual({ user_id: bob.id, user_name: bob.userName, first_name: "bob", last_name: "Tester" });
		expect(friend.they_share).toEqual({ workouts: true, recipes: true, diary: false, goals: false });
		expect(friend.workouts).toHaveLength(1);
		expect(friend.recipes).toHaveLength(1);
		expect(friend.diary).toBeUndefined();
		expect(friend.goals).toBeUndefined();
	});

	test("turning a share off hides that section", async () => {
		await request(app).patch(`/friends/${alice.id}/permissions`).set(bearer(bob)).send({ workouts: false });

		const resp = await request(app).get(`/friends/${bob.id}?start_date=2026-09-01`).set(bearer(alice));
		expect(resp.body.friend.workouts).toBeUndefined();

		const detail = await request(app).get(`/friends/${bob.id}/workouts/${bob_workout.workout_id}`).set(bearer(alice));
		expect(detail.status).toBe(403);

		await request(app).patch(`/friends/${alice.id}/permissions`).set(bearer(bob)).send({ workouts: true });
	});

	test("friend workout detail comes back in the editor shape", async () => {
		const resp = await request(app).get(`/friends/${bob.id}/workouts/${bob_workout.workout_id}`).set(bearer(alice));
		expect(resp.status).toBe(200);
		expect(resp.body.workout.workout_id).toBe(bob_workout.workout_id);
		expect(resp.body.workout.workout_name).toBe("Push day");
	});

	test("a workout id that isn't the friend's -> 404", async () => {
		const alice_workout = await createWorkout(alice);
		const resp = await request(app).get(`/friends/${bob.id}/workouts/${alice_workout.workout_id}`).set(bearer(alice));
		expect(resp.status).toBe(404);
	});

	test("friend recipe detail", async () => {
		const resp = await request(app).get(`/friends/${bob.id}/recipes/${bob_recipe.recipe_id}`).set(bearer(alice));
		expect(resp.status).toBe(200);
		expect(resp.body.recipe.name).toBe("Chili");
	});

	test("non-friends get 404 on everything", async () => {
		expect((await request(app).get(`/friends/${bob.id}?start_date=2026-09-01`).set(bearer(stranger))).status).toBe(404);
		expect((await request(app).get(`/friends/${bob.id}/workouts/${bob_workout.workout_id}`).set(bearer(stranger))).status).toBe(404);
		expect((await request(app).patch(`/friends/${bob.id}/permissions`).set(bearer(stranger)).send({ diary: true })).status).toBe(404);
	});

	test("a pending request isn't enough to view data -> 404", async () => {
		const carl = await registerUser("carl");
		await sendRequest(carl, bob);
		const resp = await request(app).get(`/friends/${bob.id}?start_date=2026-09-01`).set(bearer(carl));
		expect(resp.status).toBe(404);
	});
});
