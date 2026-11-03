const { DataTypes } = require("sequelize");
const sequelize = require("./db");

// One row per (group, user) - composite PK on (group_id, user_id) blocks duplicate memberships.
// Look rows up with findOne({ where: { group_id, user_id } }) (findByPk doesn't take composite keys).
// status covers all three join policies:
//   open        -> row created as "active"
//   request     -> user creates "pending", owner/admin flips to "active"
//   invite_only -> owner/admin creates "invited" (invited_by set), user accepts -> "active"
const group_members = sequelize.define(
	"group_members",
	{
		group_id: {
			//foreign key, part of composite PK
			type: DataTypes.INTEGER,
			primaryKey: true,
		},
		user_id: {
			//foreign key, part of composite PK
			type: DataTypes.INTEGER,
			primaryKey: true,
		},
		role: {
			type: DataTypes.ENUM("owner", "admin", "member"),
			allowNull: false,
			defaultValue: "member",
		},
		status: {
			//for (group|person), pending is request. Invited by owner/admin. Or active-Open join
			type: DataTypes.ENUM("pending", "invited", "active", "banned"),
			allowNull: false,
			defaultValue: "active",
		},
		//who sent the invite (invite_only groups). Null for self-joins/requests
		invited_by: {
			//foreign key
			type: DataTypes.INTEGER,
			allowNull: true,
		},
	},
	{
		tableName: "group_members",
		timestamps: true,
		underscored: true,
		//PK index starts with group_id, so "which groups is this user in" needs its own index
		indexes: [{ fields: ["user_id"] }],
	},
);

module.exports = group_members;
