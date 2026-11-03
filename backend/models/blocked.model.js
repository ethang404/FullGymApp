const { DataTypes } = require("sequelize");
const sequelize = require("./db");

// One row per (user_id, blocked_user_id) - composite PK on (user_id, blocked_user_id) blocks duplicate memberships.
//Can have opposite order for blocker_id and blocked_id depending on who blocked whom
//(could have 2 rows for a relationship instead of 1 like friends)
const blocked_users = sequelize.define(
	"blocked_users",
	{
		blocker_id: {
			//who did the blocking
			type: DataTypes.INTEGER,
			primaryKey: true,
		},
		blocked_user_id: {
			//blocked user
			type: DataTypes.INTEGER,
			primaryKey: true,
		},
	},
	{
		tableName: "blocked_users",
		timestamps: true,
		underscored: true,

		indexes: [{ fields: ["blocked_user_id"] }],
		validate: {
			userOrder() {
				const correctOrder = this.blocker_id && this.blocked_user_id && this.blocker_id != this.blocked_user_id;
				if (!correctOrder) {
					throw new Error("user_id must be < than blocked_user_id. And both must be defined");
				}
			},
		},
	},
);

module.exports = blocked_users;
