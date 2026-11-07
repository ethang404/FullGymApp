const { DataTypes } = require("sequelize");
const sequelize = require("./db");

const workouts = sequelize.define(
	"workouts",
	{
		workout_id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		user_id: {
			//foreign key
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		name: {
			type: DataTypes.STRING,
		},
		workout_date: {
			type: DataTypes.DATEONLY,
			allowNull: false,
		},
		notes: {
			type: DataTypes.STRING(255),
		},
		started_at: {
			//when the workout started - the editor stamps it when a new workout is opened, and an edit can correct it.
			//duration is finished_at - started_at.
			type: DataTypes.DATE,
		},
		finished_at: {
			//when workout was finished. Could be null, should maybe auto apply if past 2 hours.
			type: DataTypes.DATE,
		},
	},
	{
		tableName: "workouts",
		timestamps: true,
		underscored: true,
	},
);
module.exports = workouts;
