//Express 5 error middleware - any error thrown in a route (sync or async) ends up here, so controllers don't need try/catch.

//Our errors (error.js) carry a StatusCode. express.json() errors (bad JSON body) carry status + expose.
//Anything else is a 500 with a generic message - the real error only goes to the logs, never to the client.
//next is unused but has to stay - Express only treats a function as error middleware if it takes 4 params
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
	if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
	if (error.expose && error.status) return res.status(error.status).json({ message: error.message });

	console.error(`${req.method} ${req.originalUrl} failed`, error);
	return res.status(500).json({ message: "Something went wrong" });
}

module.exports = { errorHandler };
