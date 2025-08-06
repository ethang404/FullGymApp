module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		"diaryentries",
		{
			entry_id: {
				type: DataTypes.UUID,
				primaryKey: true,
				defaultValue: DataTypes.UUIDV4,
			},
			user_id: {
				//foreign key
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			entry_date: {
				type: DataTypes.DATEONLY,
			},
			meal_type: {
				//breakfest/lunch/dinner
				type: DataTypes.STRING,
				allowNull: false,
			},
			spoonacular_id: {
				//id of food
				type: DataTypes.INTEGER,
			},
			food_name: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			quantity: {
				type: DataTypes.INTEGER,
				defaultValue: 1,
			},
			units: {
				type: DataTypes.STRING,
			},
			notes: {
				type: DataTypes.STRING,
			},
			date_added: {
				type: DataTypes.DATEONLY,
			},
			protein: {
				type: DataTypes.DECIMAL,
			},
			carbs: {
				type: DataTypes.DECIMAL,
			},
			fats: {
				type: DataTypes.DECIMAL,
			},
			calories: {
				type: DataTypes.DECIMAL,
			},
		},
		{
			tableName: "diary_entries",
			timestamps: false,
			underscored: true,
		}
	);
};
