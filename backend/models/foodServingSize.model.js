const { DataTypes } = require("sequelize");
const sequelize = require("./db");

const foodServingSize = sequelize.define(
	"foodServingSize",
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
		label: {
			// the unit name as the user/frontend will send it
			// e.g. "serving", "tbsp", "cup", "slice", "oz", "ml"
			// this string is what gets stored in diary_entries.unit
			// and recipe_ingredients.unit - looked up at calc time
			type: DataTypes.TEXT,
			allowNull: false,
		},
		weight_g: {
			// grams for ONE of this unit
			// e.g. label="tbsp", weight_g=13.7 → 1 tbsp of this food = 13.7g
			// e.g. label="serving", weight_g=32 → 1 serving = 32g
			// user logs quantity=4, unit="tbsp" → toGrams = 4 * 13.7 = 54.8g
			type: DataTypes.DECIMAL,
			allowNull: false,
		},
	},
	{
		tableName: "food_serving_sizes",
		timestamps: false,
		underscored: true,
		indexes: [
			{ fields: ["food_id"] },
			{
				// no duplicate labels per food
				unique: true,
				fields: ["food_id", "label"],
			},
		],
	},
);

module.exports = foodServingSize;
