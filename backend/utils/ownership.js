const { NotFoundError } = require("../error");

//Make sure whatever you query belongs to user_id (workout/recipe etc). Someone else's/doesn't exist row is a 404
//options go straight to findOne (include, order, transaction). options.where adds conditions, e.g. { is_deleted: false }
//We centralize this to not forget ownership checks like previously

//where defaults to {}, as does options.
async function findOwned(model, id, user_id, label, options = {}) {
	const { where = {}, ...rest } = options;
	const row = await model.findOne({ where: { ...where, [model.primaryKeyAttribute]: id, user_id }, ...rest });
	if (!row) throw new NotFoundError(`${label} not found`);
	return row;
}

module.exports = { findOwned };
