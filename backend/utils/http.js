//turns a thrown error into a json response. Our errors (error.js) carry a StatusCode, anything else is a 500
function handleError(res, error) {
	console.error(error);
	if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
	return res.status(500).json({ message: error.message });
}

module.exports = { handleError };
