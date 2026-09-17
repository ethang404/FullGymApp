const service = require("./service");

function handleError(res, error) {
	console.error(error);
	if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
	return res.status(500).json({ message: error.message });
}

// Body: { addressee_user_id }
async function sendRequest(req, res) {
	try {
		const { friendship, created } = await service.sendRequest(req.user_id, req.body.addressee_user_id);
		return res.status(created ? 201 : 200).json({ friendship });
	} catch (error) {
		return handleError(res, error);
	}
}

async function acceptRequest(req, res) {
	try {
		const friendship = await service.acceptRequest(parseInt(req.params.id, 10), req.user_id);
		return res.status(200).json({ friendship });
	} catch (error) {
		return handleError(res, error);
	}
}

async function deletePendingRequest(req, res) {
	try {
		const result = await service.deletePendingRequest(parseInt(req.params.id, 10), req.user_id);
		return res.status(200).json(result);
	} catch (error) {
		return handleError(res, error);
	}
}

async function removeFriend(req, res) {
	try {
		const result = await service.removeFriend(parseInt(req.params.id, 10), req.user_id);
		return res.status(200).json(result);
	} catch (error) {
		return handleError(res, error);
	}
}

async function listFriends(req, res) {
	try {
		const friends = await service.listFriends(req.user_id);
		return res.status(200).json({ friends });
	} catch (error) {
		return handleError(res, error);
	}
}

// /friends/requests?direction=incoming|outgoing
async function listRequests(req, res) {
	try {
		const requests = await service.listRequests(req.user_id, req.query.direction);
		return res.status(200).json({ requests });
	} catch (error) {
		return handleError(res, error);
	}
}

// /friends/search?query=&limit=
async function searchUsers(req, res) {
	try {
		const results = await service.searchUsers(req.user_id, req.query.query, req.query.limit);
		return res.status(200).json({ results });
	} catch (error) {
		return handleError(res, error);
	}
}

module.exports = {
	sendRequest,
	acceptRequest,
	deletePendingRequest,
	removeFriend,
	listFriends,
	listRequests,
	searchUsers,
};
