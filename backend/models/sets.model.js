module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
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
			tableName: "sets",
			timestamps: false,
			underscored: true,
		}
	);
};
