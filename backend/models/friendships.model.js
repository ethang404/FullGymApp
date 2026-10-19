const { DataTypes } = require("sequelize");
const sequelize = require("./db");

// Always stored with user_id_a < user_id_b so a single
// unique index on (user_id_a, user_id_b) blocks both exact duplicates and
// reciprocal A->B / B->A rows. So we don't have rows for John/Steve AND Steve/John
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
			//between a/b, who requested
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
