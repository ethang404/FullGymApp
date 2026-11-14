const { DataTypes } = require("sequelize");
const sequelize = require("./db");

const post_comments = sequelize.define(
	"post_comments",
	{
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		post_id: {
			//foreign key
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		user_id: {
			//foreign key, the commenter
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		body: {
			type: DataTypes.STRING(500),
			allowNull: false,
			validate: { notEmpty: true },
		},
	},
	{
		tableName: "post_comments",
		timestamps: true,
		underscored: true,
		indexes: [{ fields: ["post_id", "created_at"] }, { fields: ["user_id"] }],
	},
);

module.exports = post_comments;
