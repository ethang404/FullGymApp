module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		"exercises",
		{
			exercise_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			exercise_name: {
				type: DataTypes.STRING(30),
				allowNull: false,
			},
			workout_id: {
				//foreign key
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			notes: {
				type: DataTypes.STRING(100),
				allowNull: true,
			},
		},
		{
			tableName: "exercises",
			timestamps: false,
			underscored: true,
		}
	);
};
