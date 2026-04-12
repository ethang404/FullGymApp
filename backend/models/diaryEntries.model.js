const { DataTypes } = require("sequelize");
const sequelize = require("./db");

const diary_entries = sequelize.define(
	"diaryentries",
	{
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		user_id: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		food_id: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		meal_type: {
			type: DataTypes.ENUM("breakfast", "lunch", "dinner", "snack"),
			allowNull: false,
		},
		logged_at: {
			type: DataTypes.DATEONLY,
			allowNull: false,
		},
		quantity: {
			type: DataTypes.DECIMAL,
			allowNull: false,
		},
		unit: {
			type: DataTypes.TEXT,
			allowNull: false,
			// e.g. 'serving', 'g', 'oz', 'cup'. Whatever is available for that food
		},
	},
	{
		tableName: "food_log_entries",
		timestamps: true,
		underscored: true,
		indexes: [
			{
				// most common query: get all entries for a user on a given day
				fields: ["user_id", "logged_at"],
			},
			{
				// for queries like "all days this user logged this food"
				fields: ["user_id", "food_id"],
			},
		],
	},
);

module.exports = diary_entries;
