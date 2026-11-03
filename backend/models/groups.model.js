const { DataTypes } = require("sequelize");
const sequelize = require("./db");

const groups = sequelize.define(
	"groups",
	{
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		description: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		//user who created the group. Nullable + SET NULL so deleting the creator's account doesn't wipe group
		created_by: {
			//foreign key
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		//open: anyone can join, request: owner/admin approves, invite_only: must be invited
		join_policy: {
			type: DataTypes.ENUM("open", "request", "invite_only"),
			allowNull: false,
			defaultValue: "open",
		},
	},
	{
		tableName: "groups",
		timestamps: true,
		underscored: true,
		indexes: [{ fields: ["created_by"] }],
	},
);

module.exports = groups;
