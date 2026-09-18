const service = require("./service");

function handleError(res, error) {
	console.error(error);
	if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
	return res.status(500).json({ message: error.message });
}

// GET /explore?type=recipe|workout|all&scope=all|friends|public|mine&search=&cursor=&limit=20
async function getExploreFeed(req, res) {
	try {
		const { type, scope, search, cursor, limit } = req.query;
		const feed = await service.getExploreFeed(req.user_id, { type, scope, search, cursor, limit });
		return res.status(200).json(feed);
	} catch (error) {
		return handleError(res, error);
	}
}

module.exports = { getExploreFeed };
