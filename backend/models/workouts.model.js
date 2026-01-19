module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
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
			created_at: {
				type: DataTypes.DATE,
				defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
			},
			finished_at: {
				type: DataTypes.DATE,
			},
		},
		{
			tableName: "workouts",
			timestamps: true,
			underscored: true,
		},
	);
};
