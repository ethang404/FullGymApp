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
			// USDA's unique ID for food from DB
			// null if user submitted their own food
			type: DataTypes.INTEGER,
			unique: true,
			allowNull: true,
		},
		name: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		brand: {
			// e.g. "Walmart", "Chobani"
			// null for generic whole foods like "chicken breast"
			type: DataTypes.TEXT,
			allowNull: true,
		},
		barcode: {
			// for barcode scanning via Open Food Facts
			// null if not a packaged product
			type: DataTypes.TEXT,
			allowNull: true,
		},
		serving_size_g: {
			// serving size in grams e.g. 140
			// used to convert "1 serving" → grams for math
			type: DataTypes.DECIMAL(10, 2),
			allowNull: true,
		},
		serving_size_label: {
			// serving size: "1 cup", "3 oz"
			type: DataTypes.TEXT,
			allowNull: true,
		},
		source: {
			// where food came from
			// 'usda' = USDA database
			// 'user_submitted' = user added
			type: DataTypes.TEXT,
			allowNull: false,
		},
		submitted_by: {
			// FK: null if source is USDA
			// set to user's id if source is 'user_submitted'
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		is_deleted: {
			// soft delete to delete foods if user submits bad data
			// because users may have diary entries referencing this food
			// instead we hide it from search results
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

//Creates gini index's to use tsvector so better searching.
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
