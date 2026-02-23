const { DataTypes } = require("sequelize");
const sequelize = require("./db");

const sets = sequelize.define(
	"sets",
	{
		set_id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		exercise_id: {
			//foreign key
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		set_type: {
			type: DataTypes.STRING(100), //0 is warmup, 1+ set number
			allowNull: false,
		},
		notes: {
			type: DataTypes.STRING(100),
			allowNull: true,
		},
		reps: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		weight: {
			type: DataTypes.DECIMAL,
			allowNull: true,
			get() {
				//I need this cause sequelize (and postgres with it) store deciaml as string i guess
				const rawValue = this.getDataValue("weight");
				return rawValue ? parseFloat(rawValue) : null;
			},
		},
		order_number: {
			type: DataTypes.INTEGER, //order of sets for workout
			allowNull: false,
		},
	},
	{
		tableName: "sets",
		timestamps: true,
		underscored: true,
	},
);
module.exports = sets;
