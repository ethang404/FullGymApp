// Fixtures for friends.test.js — mirrors the UsersPayloads.js / WorkoutPayloads.js convention.
// Three users so we can exercise both sides of a request plus an unrelated third party.

const userAPayload = {
	firstName: "Alice",
	lastName: "Anders",
	userName: "friends_alice",
	password: "FriendsUser123!",
};

const userBPayload = {
	firstName: "Bianca",
	lastName: "Brooks",
	userName: "friends_bianca",
	password: "FriendsUser123!",
};

const userCPayload = {
	firstName: "Cole",
	lastName: "Carter",
	userName: "friends_cole",
	password: "FriendsUser123!",
};

module.exports = { userAPayload, userBPayload, userCPayload };
