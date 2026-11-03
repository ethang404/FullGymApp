const service = require("./service");
const { handleError } = require("../utils/http");

// ---------------------------------------------
// Friend requests
// ---------------------------------------------

async function getRequests(req, res) {
	try {
		const requests = await service.getRequests(req.user_id); //{ incoming: [...], outgoing: [...] }
		return res.status(200).json({ requests });
	} catch (error) {
		return handleError(res, error);
	}
}

// Body needs: { user_id } - the person you're sending the request to
async function sendRequest(req, res) {
	const target_user_id = parseInt(req.body.user_id, 10);
	try {
		const request = await service.sendRequest(req.user_id, target_user_id);
		return res.status(201).json({ request });
	} catch (error) {
		return handleError(res, error);
	}
}

async function acceptRequest(req, res) {
	const friendship_id = parseInt(req.params.friendship_id, 10);
	try {
		const friendship = await service.acceptRequest(friendship_id, req.user_id);
		return res.status(200).json({ friendship });
	} catch (error) {
		return handleError(res, error);
	}
}

//decline if you received it, cancel if you sent it
async function deleteRequest(req, res) {
	const friendship_id = parseInt(req.params.friendship_id, 10);
	try {
		await service.deleteRequest(friendship_id, req.user_id);
		return res.status(200).json({ message: "Request removed" });
	} catch (error) {
		return handleError(res, error);
	}
}

// ---------------------------------------------
// Friends
// ---------------------------------------------

async function getFriends(req, res) {
	try {
		const friends = await service.getFriends(req.user_id);
		return res.status(200).json({ friends });
	} catch (error) {
		return handleError(res, error);
	}
}

async function removeFriend(req, res) {
	const friend_id = parseInt(req.params.friend_id, 10);
	try {
		await service.removeFriend(req.user_id, friend_id);
		return res.status(200).json({ message: "Friend removed" });
	} catch (error) {
		return handleError(res, error);
	}
}

// Body: { workouts?, recipes?, diary?, goals? } - only updates MY row (owner_id = req.user_id)
async function updatePermissions(req, res) {
	const friend_id = parseInt(req.params.friend_id, 10);
	try {
		const permissions = await service.updatePermissions(req.user_id, friend_id, req.body);
		return res.status(200).json({ permissions });
	} catch (error) {
		return handleError(res, error);
	}
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
	try {
		const friend = await service.getFriendOverview(req.user_id, friend_id, start_date, end_date);
		return res.status(200).json({ friend });
	} catch (error) {
		return handleError(res, error);
	}
}

async function getFriendWorkout(req, res) {
	const friend_id = parseInt(req.params.friend_id, 10);
	const workout_id = parseInt(req.params.workout_id, 10);
	try {
		const workout = await service.getFriendWorkout(req.user_id, friend_id, workout_id);
		return res.status(200).json({ workout });
	} catch (error) {
		return handleError(res, error);
	}
}

async function getFriendRecipe(req, res) {
	const friend_id = parseInt(req.params.friend_id, 10);
	const recipe_id = parseInt(req.params.recipe_id, 10);
	try {
		const recipe = await service.getFriendRecipe(req.user_id, friend_id, recipe_id);
		return res.status(200).json({ recipe });
	} catch (error) {
		return handleError(res, error);
	}
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
