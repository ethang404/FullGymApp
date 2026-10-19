const { DataTypes } = require("sequelize");
const sequelize = require("./db");

const diaryEntries = sequelize.define(
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
			// set when logging a food directly, null when logging a recipe
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		recipe_id: {
			// set when logging a recipe, null when logging a food
			// FK to recipes.recipe_id
			type: DataTypes.INTEGER,
			allowNull: true,
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
			// for food entries: amount in whatever unit (e.g. 4 if unit is "tbsp")
			// for recipe entries: number of servings relative to recipe.servings
			//   e.g. recipe.servings=4, quantity=2 → user ate half the recipe
			type: DataTypes.DECIMAL,
			allowNull: false,
		},
		unit: {
			// for food entries: matches a label in food_serving_sizes for this food
			//   e.g. "g", "tbsp", "serving", "slice"
			//   "g" and "kg" are universal - no food_serving_sizes lookup needed
			//   everything else is looked up by (food_id, label) at calc time
			// for recipe entries: always "serving"
			type: DataTypes.TEXT,
			allowNull: false,
		},
	},
	{
		tableName: "diary_entries",
		timestamps: true,
		underscored: true,
		indexes: [{ fields: ["user_id", "logged_at"] }, { fields: ["user_id", "food_id"] }, { fields: ["user_id", "recipe_id"] }],
	},
);

// DB-level constraint: exactly one of food_id or recipe_id must be set
// Run this once after sync - IF NOT EXISTS so safe to call repeatedly
const addDiaryConstraint = async () => {
	await sequelize.query(`
		ALTER TABLE diary_entries
		ADD CONSTRAINT IF NOT EXISTS chk_food_or_recipe
		CHECK (
			(food_id IS NOT NULL AND recipe_id IS NULL) OR
			(food_id IS NULL AND recipe_id IS NOT NULL)
		);
	`);
};

module.exports = { diaryEntries, addDiaryConstraint };
