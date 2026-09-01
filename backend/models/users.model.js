const { DataTypes } = require("sequelize");
const sequelize = require("./db");

//passing in singleton sequelize instance
const users = sequelize.define(
	"users",
	{
		user_id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		first_name: {
			type: DataTypes.STRING,
		},
		last_name: {
			type: DataTypes.STRING,
		},
		user_name: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
		},
		password: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		spoon_username: {
			type: DataTypes.STRING,
		},
		spoon_hash: {
			type: DataTypes.STRING,
		},

		// ── Body metrics (feed the Mifflin–St Jeor calculator) ──
		sex: {
			type: DataTypes.ENUM("male", "female"),
		},
		birth_date: {
			type: DataTypes.DATEONLY,
		},
		height_cm: {
			type: DataTypes.DECIMAL,
		},
		weight_kg: {
			type: DataTypes.DECIMAL,
		},
		activity_level: {
			type: DataTypes.ENUM("sedentary", "light", "moderate", "active", "very_active"),
		},
		goal_type: {
			type: DataTypes.ENUM("lose", "maintain", "gain"),
		},

		// ── Goal macros. Null => fall back to GOAL_DEFAULTS. ──
		goal_calories: {
			type: DataTypes.INTEGER,
		},
		goal_protein_g: {
			type: DataTypes.INTEGER,
		},
		goal_carbs_g: {
			type: DataTypes.INTEGER,
		},
		goal_fat_g: {
			type: DataTypes.INTEGER,
		},
		goal_fiber_g: {
			type: DataTypes.INTEGER,
		},

		// Whether the user has been through the first-run goal setup.
		onboarding_completed: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
	},
	{
		tableName: "users",
		timestamps: true,
		underscored: true,
	},
);
module.exports = users;
