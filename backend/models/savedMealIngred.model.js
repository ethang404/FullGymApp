module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		"saved_meal_ingredients",
		{
			ingredient_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			saved_meal_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			spoonacular_id: {
				type: DataTypes.INTEGER,
				allowNull: true,
			},
			ingredient_name: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			quantity: {
				type: DataTypes.DECIMAL,
				allowNull: false,
			},
			unit: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			calories: {
				type: DataTypes.DECIMAL,
				allowNull: true,
			},
			protein: {
				type: DataTypes.DECIMAL,
				allowNull: true,
			},
			carbs: {
				type: DataTypes.DECIMAL,
				allowNull: true,
			},
			fat: {
				type: DataTypes.DECIMAL,
				allowNull: true,
			},
		},
		{
			tableName: "saved_meal_ingredients",
			timestamps: false,
			underscored: true,
		}
	);
};
