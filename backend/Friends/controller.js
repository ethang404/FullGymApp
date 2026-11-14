const service = require("./service");

// ---------------------------------------------
// Friend requests
// ---------------------------------------------

async function getRequests(req, res) {
	const requests = await service.getRequests(req.user_id); //{ incoming: [...], outgoing: [...] }
	return res.status(200).json({ requests });
}

// Body needs: { user_id } - the person you're sending the request to
async function sendRequest(req, res) {
	const target_user_id = parseInt(req.body.user_id, 10);
	const request = await service.sendRequest(req.user_id, target_user_id);
	return res.status(201).json({ request });
}

async function acceptRequest(req, res) {
	const friendship_id = parseInt(req.params.friendship_id, 10);
	const friendship = await service.acceptRequest(friendship_id, req.user_id);
	return res.status(200).json({ friendship });
}

//decline if you received it, cancel if you sent it
async function deleteRequest(req, res) {
	const friendship_id = parseInt(req.params.friendship_id, 10);
	await service.deleteRequest(friendship_id, req.user_id);
	return res.status(200).json({ message: "Request removed" });
}

// ---------------------------------------------
// Friends
// ---------------------------------------------

async function getFriends(req, res) {
	const friends = await service.getFriends(req.user_id);
	return res.status(200).json({ friends });
}

async function removeFriend(req, res) {
	const friend_id = parseInt(req.params.friend_id, 10);
	await service.removeFriend(req.user_id, friend_id);
	return res.status(200).json({ message: "Friend removed" });
}

// Body: { workouts?, recipes?, diary?, goals? } - only updates MY row (owner_id = req.user_id)
async function updatePermissions(req, res) {
	const friend_id = parseInt(req.params.friend_id, 10);
	const permissions = await service.updatePermissions(req.user_id, friend_id, req.body);
	return res.status(200).json({ permissions });
}

// ---------------------------------------------
// Viewing a friend's data
// ---------------------------------------------
// Workouts come back from the service already in the same shape as GET /workouts
// (e.g. straight from Workouts/service.js GetWorkouts / GetWorkout)

// Query: ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD bounds workouts + diary (recipes are always sent in full)
// Service returns { user, they_share, workouts?, recipes?, diary?, goals? } - sections they don't share are left out
async function getFriendOverview(req, res) {
	const friend_id = parseInt(req.params.friend_id, 10);
	const { start_date, end_date } = req.query;
	const friend = await service.getFriendOverview(req.user_id, friend_id, start_date, end_date);
	return res.status(200).json({ friend });
}

async function getFriendWorkout(req, res) {
	const friend_id = parseInt(req.params.friend_id, 10);
	const workout_id = parseInt(req.params.workout_id, 10);
	const workout = await service.getFriendWorkout(req.user_id, friend_id, workout_id);
	return res.status(200).json({ workout });
}

async function getFriendRecipe(req, res) {
	const friend_id = parseInt(req.params.friend_id, 10);
	const recipe_id = parseInt(req.params.recipe_id, 10);
	const recipe = await service.getFriendRecipe(req.user_id, friend_id, recipe_id);
	return res.status(200).json({ recipe });
}

module.exports = {
	getRequests,
	sendRequest,
	acceptRequest,
	deleteRequest,
	getFriends,
	removeFriend,
	updatePermissions,
	getFriendOverview,
	getFriendWorkout,
	getFriendRecipe,
};
