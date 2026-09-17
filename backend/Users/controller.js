const service = require("./service");

function handleError(res, error) {
	console.error(error);
	if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
	return res.status(500).json({ message: error.message });
}

async function getMe(req, res) {
	try {
		const user = await service.getMe(req.user_id);
		return res.status(200).json({ user });
	} catch (error) {
		return handleError(res, error);
	}
}

async function updateMe(req, res) {
	try {
		const user = await service.updateMe(req.user_id, req.body);
		return res.status(200).json({ user });
	} catch (error) {
		return handleError(res, error);
	}
}

async function estimateGoals(req, res) {
	try {
		const estimate = service.estimate(req.body);
		return res.status(200).json({ estimate });
	} catch (error) {
		return handleError(res, error);
	}
}

module.exports = { getMe, updateMe, estimateGoals };
