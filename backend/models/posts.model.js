const { DataTypes } = require("sequelize");
const sequelize = require("./db");

// A post shares exactly ONE thing: a workout, a recipe, or a diary entry.
//
// visibility:
//   public -> anyone, group_id must be null
//   group  -> members of group_id only, group_id required
const posts = sequelize.define(
	"posts",
	{
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		user_id: {
			//foreign key
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		visibility: {
			type: DataTypes.ENUM("public", "group"),
			allowNull: false,
			defaultValue: "public",
		},
		group_id: {
			//foreign key, only set when visibility = "group"
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		workout_id: {
			//foreign key -> workouts.workout_id
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		recipe_id: {
			//foreign key -> recipes.recipe_id
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		diary_log_id: {
			//foreign key -> diary_entries.id
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		caption: {
			type: DataTypes.STRING(500),
			allowNull: true,
		},
	},
	{
		tableName: "posts",
		timestamps: true,
		underscored: true,
		indexes: [
			{ fields: ["user_id", "created_at"] }, //a user's own posts
			{ fields: ["group_id", "created_at"] }, //group feed
			{ fields: ["visibility", "created_at"] }, //public feed
			{ fields: ["workout_id"] },
			{ fields: ["recipe_id"] },
			{ fields: ["diary_log_id"] },
		],

		//runs on create/save. Database level CHECK statement sort of deal
		validate: {
			exactlyOneAttachment() {
				const attached = [this.workout_id, this.recipe_id, this.diary_log_id].filter((v) => v != null);
				if (attached.length !== 1) {
					throw new Error("A post must reference exactly one of workout_id, recipe_id, or diary_log_id");
				}
			},
			groupMatchesVisibility() {
				if ((this.visibility === "group") !== (this.group_id != null)) {
					throw new Error("group_id is required for group posts and must be null for public posts");
				}
			},
		},
	},
);

module.exports = posts;
