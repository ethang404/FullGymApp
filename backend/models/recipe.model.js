const { DataTypes } = require("sequelize");
const sequelize = require("./db");

const recipe = sequelize.define(
	"recipe",
	{
		recipe_id: {
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
		servings: {
			// how many servings this recipe makes in total
			// used to scale macros when logging:
			// user logs quantity=2, recipe.servings=4 → scale = 2/4 = 0.5 → half the macros
			// defaults to 1 so the whole recipe = 1 serving if not specified
			type: DataTypes.DECIMAL,
			allowNull: false,
			defaultValue: 1,
		},
	},
	{
		tableName: "recipes",
		timestamps: true,
		underscored: true,
		indexes: [
			{ fields: ["user_id"] },
		],
	},
);

module.exports = recipe;
