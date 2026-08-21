const { DataTypes } = require("sequelize");
const sequelize = require("./db");

const exercise_catalog = sequelize.define(
	"exercise_catalog",
	{
		catalog_id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		name: {
			type: DataTypes.STRING(30),
			allowNull: false,
			unique: true,
		},
		muscle_group: {
			type: DataTypes.ENUM("chest", "back", "shoulders", "biceps", "triceps", "legs", "glutes", "core", "full_body", "cardio"),
			allowNull: false,
		},
		is_deleted: {
			// soft delete - hides from search but preserves history for people
			type: DataTypes.BOOLEAN,
			defaultValue: false,
			allowNull: false,
		},
	},
	{
		tableName: "exercise_catalog",
		timestamps: true,
		underscored: true,
	},
);

//Might add later
/* const addSearchIndexes = async () => {
	await sequelize.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
	await sequelize.query(`
	CREATE INDEX IF NOT EXISTS exercise_catalog_name_trgm_idx
	ON exercise_catalog USING GIN (name gin_trgm_ops);
`);
}; */

module.exports = exercise_catalog;
