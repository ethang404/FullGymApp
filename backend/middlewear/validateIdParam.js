//router.param hook for :id style params. Has to be a positive whole number that fits in a postgres INTEGER,
//otherwise "abc" / "1.5" / "-3" would reach the database and come back as a 500 instead of a 400.
//usage in a route file: router.param("id", validateIdParam);
const MAX_INT = 2147483647;

function validateIdParam(req, res, next, value, name) {
	if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > MAX_INT) {
		return res.status(400).json({ message: `${name} must be a valid id` });
	}
	next();
}

module.exports = validateIdParam;
