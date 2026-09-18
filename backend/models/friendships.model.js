const { DataTypes } = require("sequelize");
const sequelize = require("./db");

// Always stored with user_id_a < user_id_b (see Friends/service.js) so a single
// unique index on (user_id_a, user_id_b) blocks both exact duplicates and
// reciprocal A->B / B->A rows. requested_by records who sent the request, since
// that's not derivable from the a/b ordering.
const friendships = sequelize.define(
	"friendships",
	{
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		user_id_a: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		user_id_b: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		requested_by: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		status: {
			type: DataTypes.ENUM("pending", "accepted"),
			allowNull: false,
			defaultValue: "pending",
		},
	},
	{
		tableName: "friendships",
		timestamps: true,
		underscored: true,
		indexes: [{ unique: true, fields: ["user_id_a", "user_id_b"] }, { fields: ["requested_by"] }],
	},
);

module.exports = friendships;
