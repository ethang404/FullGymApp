const { DataTypes } = require("sequelize");
const sequelize = require("./db");

const exercises = sequelize.define(
	"exercises",
	{
		exercise_id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		workout_id: {
			//foreign key
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		catalog_id: {
			type: DataTypes.INTEGER, //foreign key, this is the ground truth label for knowing our exercise name
			allowNull: false,
		},
		notes: {
			type: DataTypes.STRING(100),
			allowNull: true,
		},
		order_number: {
			type: DataTypes.INTEGER, //order of exercises for workout
			allowNull: false,
		},
	},
	{
		tableName: "exercises",
		timestamps: true,
		underscored: true,
		indexes: [{ fields: ["workout_id"] }, { fields: ["catalog_id"] }], //apparently I have to add fk index's manually
	},
);
module.exports = exercises;
