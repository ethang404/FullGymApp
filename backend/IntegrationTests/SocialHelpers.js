// Shared setup for the social suites (friends / groups / posts / users social).
// Same idea as the *Payloads.js files, but these need the app, so they're helpers instead of plain objects.
const request = require("supertest");
const app = require("../app");
const { workouts: WorkoutsModel, recipe: RecipeModel } = require("../models/modelInits");

//user_name is unique, so every registered user gets a counter suffix
let user_count = 0;

//real account. Returns { id, token, userName }
async function registerUser(prefix = "user") {
	user_count += 1;
	const userName = `${prefix}_${user_count}`;
	const resp = await request(app)
		.post("/auth/register")
		.send({ firstName: prefix, lastName: "Tester", userName, password: "SocialTest123!" });
	return { id: resp.body.userId, token: resp.body.accessToken, userName };
}

async function createGuest() {
	const resp = await request(app).post("/auth/guest");
	return { id: resp.body.userId, token: resp.body.accessToken };
}

const bearer = (user) => ({ Authorization: `Bearer ${user.token}` });

//straight to the DB - the social suites only need something to share, not the workout/recipe endpoints
function createWorkout(user, name = "Push day") {
	return WorkoutsModel.create({ user_id: user.id, name, workout_date: "2026-10-01" });
}

function createRecipe(user, name = "Chili") {
	return RecipeModel.create({ user_id: user.id, name, servings: 4 });
}

//friend request + accept, so a and b are friends with default permissions
async function makeFriends(a, b) {
	const sent = await request(app).post("/friends/requests").set(bearer(a)).send({ user_id: b.id });
	await request(app).post(`/friends/requests/${sent.body.request.id}/accept`).set(bearer(b));
}

//group owned by owner. Returns the group row from the response
async function createGroup(owner, data = {}) {
	const resp = await request(app)
		.post("/groups")
		.set(bearer(owner))
		.send({ name: "Lifters", join_policy: "open", ...data });
	return resp.body.group;
}

//small gap so createdAt differs between rows - the feeds' cursor is createdAt only
const tick = () => new Promise((resolve) => setTimeout(resolve, 15));

module.exports = { app, registerUser, createGuest, bearer, createWorkout, createRecipe, makeFriends, createGroup, tick };
