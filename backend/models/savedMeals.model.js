const { DataTypes } = require("sequelize");
const sequelize = require("./db");

const savedMeal = sequelize.define(
	"saved_meals",
	{
		saved_meal_id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		user_id: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		description: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		created_at: {
			type: DataTypes.DATE,
			defaultValue: DataTypes.NOW,
		},
	},
	{
		tableName: "saved_meals",
		timestamps: false,
		underscored: true,
	},
);
module.exports = savedMeal;
