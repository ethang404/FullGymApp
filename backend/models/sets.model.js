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
				type: DataTypes.INTEGER, //0 is warmup, 1+ set number
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
			},
		},
		{
			tableName: "sets",
			timestamps: false,
			underscored: true,
		}
	);
};
