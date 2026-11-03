const { Op } = require("sequelize");
const { DataError } = require("../error");

//cursor pagination on createdAt, works on any model. Fetch one extra to know if there's another page
//newest_first: feeds (next page = older than cursor). false: comments (next page = newer than cursor)
async function paginate(model, { where, include, cursor, limit, newest_first = true }) {
	limit = Math.max(1, Math.min(parseInt(limit, 10) || 20, 100)); //default 20, between 1 and 100

	if (cursor) {
		if (isNaN(Date.parse(cursor))) throw new DataError("Invalid cursor");
		where = { ...where, createdAt: { [newest_first ? Op.lt : Op.gt]: cursor } };
	}

	const rows = await model.findAll({
		where,
		include,
		order: [["createdAt", newest_first ? "DESC" : "ASC"]],
		limit: limit + 1,
	});

	const has_more = rows.length > limit;
	const page = rows.slice(0, limit);
	const next_cursor = has_more ? page[page.length - 1].createdAt.toISOString() : null; //null -> no more pages
	return { rows: page, next_cursor };
}

module.exports = { paginate };
