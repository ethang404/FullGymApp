const { DataTypes } = require("sequelize");
const sequelize = require("./db");

const foodNutrient = sequelize.define(
	"foodNutrient",
	{
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		food_id: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		nutrient_id: {
			// USDA nutrient type ID
			// e.g. 1008=calories, 1003=protein, 1004=fat, 1005=carbs
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		nutrient_name: {
			// "Protein", "Sodium", "Vitamin D"
			type: DataTypes.TEXT,
			allowNull: false,
		},
		unit: {
			// display unit only - never used in math
			// "g", "mg", "ug", "kcal"
			type: DataTypes.TEXT,
			allowNull: false,
		},
		amount_per_100g: {
			// always normalized to per 100g regardless of the food's actual serving size
			// back-calculated at import: (amount_per_serving / serving_size_g) * 100
			// all macro math uses this: amount_per_100g * (logged_grams / 100)
			type: DataTypes.DECIMAL,
			allowNull: false,
		},
	},
	{
		tableName: "food_nutrients",
		timestamps: true,
		underscored: true,
		indexes: [
			{ fields: ["food_id"] },
			{ fields: ["nutrient_id"] },
			{
				// prevents duplicate nutrient rows for the same food
				unique: true,
				fields: ["food_id", "nutrient_id"],
			},
		],
	},
);

module.exports = foodNutrient;
