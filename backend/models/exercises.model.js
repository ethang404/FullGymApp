module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
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
			set_number: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			notes: {
				type: DataTypes.TEXT,
				allowNull: true,
			},
			reps: {
				type: DataTypes.INTEGER,
				allowNull: true,
			},
			weight: {
				type: DataTypes.DECIMAL,
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
