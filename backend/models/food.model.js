const { DataTypes } = require("sequelize");
const sequelize = require("./db");

const food = sequelize.define(
	"food",
	{
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		fdc_id: {
			// USDA's unique ID - null if user submitted
			type: DataTypes.INTEGER,
			unique: true,
			allowNull: true,
		},
		name: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		brand: {
			// e.g. "Walmart", "Chobani" - null for generic whole foods
			type: DataTypes.TEXT,
			allowNull: true,
		},
		barcode: {
			// for barcode scanning via Open Food Facts
			type: DataTypes.TEXT,
			allowNull: true,
		},
		source: {
			// 'usda', 'openfoodfacts', 'user_submitted'
			type: DataTypes.TEXT,
			allowNull: false,
		},
		submitted_by: {
			// FK to users.id - null if source is not user_submitted
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		is_deleted: {
			// soft delete - hides from search but preserves diary/recipe references
			type: DataTypes.BOOLEAN,
			defaultValue: false,
			allowNull: false,
		},
	},
	{
		tableName: "foods",
		timestamps: true,
		underscored: true,
	},
);

// GIN indexes for full-text + trigram search
const addSearchIndexes = async () => {
	await sequelize.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
	await sequelize.query(`
		CREATE INDEX IF NOT EXISTS foods_name_trgm_idx
		ON foods USING GIN (name gin_trgm_ops);
	`);
	await sequelize.query(`
		CREATE INDEX IF NOT EXISTS foods_name_fts_idx
		ON foods USING GIN (to_tsvector('english', name));
	`);
};

module.exports = { food, addSearchIndexes };
