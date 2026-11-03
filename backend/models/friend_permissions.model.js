const { DataTypes } = require("sequelize");
const sequelize = require("./db");

//Basically: "For this friendship relation (friendship_id), owner (owner_id) lets that person see their workouts/recipe/goals etc."
//Then for the same relation (friendship_id), owner2 (owner_id), lets the first person see THEIR stuff
const friend_permissions = sequelize.define(
	"friend_permissions",
	{
		//Composite PK [friendship_id, owner_id]
		friendship_id: {
			//friend relation identifier (FK)
			type: DataTypes.INTEGER,
			primaryKey: true,
		},
		owner_id: {
			//FK for whose data is being shared
			type: DataTypes.INTEGER,
			primaryKey: true,
		},
		workouts: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: true,
		},
		recipes: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: true,
		},
		diary: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		goals: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
	},
	{
		tableName: "friend_permissions",
		timestamps: true,
		underscored: true,
		//indexes: [{ fields: ["owner_id"] }],
	},
);

module.exports = friend_permissions;
