const { DataTypes } = require("sequelize");
const sequelize = require("./db");

const recipeIngredient = sequelize.define(
	"recipeIngredient",
	{
		ingredient_id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		recipe_id: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		food_id: {
			// every ingredient must link to a real food in the foods table
			// replaces old spoonacular_id + ingredient_name string columns
			// join to foods to get the name for display
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		quantity: {
			type: DataTypes.DECIMAL,
			allowNull: false,
		},
		unit: {
			// matches a label in food_serving_sizes for this food
			// e.g. "g", "tbsp", "serving", "slice"
			type: DataTypes.TEXT,
			allowNull: false,
		},
		// Pre-calculated macros stored at ingredient creation time.
		// Based on: quantity + unit → toGrams → calcNutrients
		// Avoids re-joining food_nutrients every time recipe is displayed.
		// Only the 4 main macros - for full nutrient breakdown join food → food_nutrients.
		// These can go stale if food nutrients are edited after recipe creation,
		// which is acceptable since USDA data is static and user edits are rare.
		calories: { type: DataTypes.DECIMAL, allowNull: true },
		protein:  { type: DataTypes.DECIMAL, allowNull: true },
		carbs:    { type: DataTypes.DECIMAL, allowNull: true },
		fat:      { type: DataTypes.DECIMAL, allowNull: true },
	},
	{
		tableName: "recipe_ingredients",
		timestamps: false,
		underscored: true,
		indexes: [
			{ fields: ["recipe_id"] },
			{ fields: ["food_id"] },
		],
	},
);

module.exports = recipeIngredient;
