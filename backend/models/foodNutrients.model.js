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
			type: DataTypes.INTEGER, //FK
			allowNull: false,
		},
		nutrient_id: {
			// USDA's ID for the nutrient type
			//Corresponds to type of nutriet. 1008 = Calories, 1003 = Protein
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		nutrient_name: {
			// "Protein", "Vitamin C"
			type: DataTypes.TEXT,
			allowNull: false,
		},
		unit: {
			// unit of measurement for this nutrient (g/kg etc)
			type: DataTypes.TEXT,
			allowNull: false,
		},
		amount_per_100g: {
			// the actual value per 100g of the food
			// all math uses this. multiply by (logged_grams / 100)
			type: DataTypes.DECIMAL(10, 4), //4th decimal place for accuracy
			allowNull: false,
		},
	},
	{
		tableName: "food_nutrients",
		timestamps: true,
		underscored: true,
		indexes: [
			{
				// most common query: get all nutrients for a food
				fields: ["food_id"],
			},
			{
				// for queries like "find all foods high in vitamin D"
				fields: ["nutrient_id"],
			},
			{
				// prevents duplicate nutrient rows for the same food
				// e.g. can't have two "Protein" rows for the same food
				unique: true,
				fields: ["food_id", "nutrient_id"],
			},
		],
	},
);

module.exports = foodNutrient;
