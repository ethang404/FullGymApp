const { DataTypes } = require("sequelize");
const sequelize = require("./db");

// One row per (post, user) - composite PK on (post_id, user_id) makes liking idempotent (a second like is
// a no-op / constraint error) and unliking is just deleting the row.
const post_likes = sequelize.define(
	"post_likes",
	{
		post_id: {
			//foreign key, part of composite PK
			type: DataTypes.INTEGER,
			primaryKey: true,
		},
		user_id: {
			//foreign key (who liked it), part of composite PK
			type: DataTypes.INTEGER,
			primaryKey: true,
		},
	},
	{
		tableName: "post_likes",
		timestamps: true,
		updatedAt: false, //a like never changes, only created/deleted
		underscored: true,
		//PK index starts with post_id, so "posts this user liked" needs its own index
		indexes: [{ fields: ["user_id"] }],
	},
);

module.exports = post_likes;
