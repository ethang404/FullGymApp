//passing in singleton sequelize instance
module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		"users",
		{
			user_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			first_name: {
				type: DataTypes.STRING,
			},
			last_name: {
				type: DataTypes.STRING,
			},
			user_name: {
				type: DataTypes.STRING,
				allowNull: false,
				unique: true,
			},
			password: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			spoon_username: {
				type: DataTypes.STRING,
			},
			spoon_hash: {
				type: DataTypes.STRING,
			},
		},
		{
			tableName: "users",
			timestamps: true,
			underscored: true,
		}
	);
};
