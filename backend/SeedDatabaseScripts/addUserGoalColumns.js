// Idempotently adds the nutrition-goal / body-metric columns to the live `users`
// table. There is no migration system in this project (sync() is commented out in
// modelInits.js and the test suites rebuild the schema with sync({force:true})),
// so this mirrors the imperative helper convention used by addSearchIndexes() /
// addDiaryConstraint().
//
// Run with:  cd backend && node SeedDatabaseScripts/addUserGoalColumns.js
// Safe to re-run - existing columns are left untouched.

require("dotenv").config();
const { DataTypes } = require("sequelize");
const sequelize = require("../models/db");

const COLUMNS = {
	sex: { type: DataTypes.ENUM("male", "female"), allowNull: true },
	birth_date: { type: DataTypes.DATEONLY, allowNull: true },
	height_cm: { type: DataTypes.DECIMAL, allowNull: true },
	weight_kg: { type: DataTypes.DECIMAL, allowNull: true },
	activity_level: {
		type: DataTypes.ENUM("sedentary", "light", "moderate", "active", "very_active"),
		allowNull: true,
	},
	goal_type: { type: DataTypes.ENUM("lose", "maintain", "gain"), allowNull: true },
	goal_calories: { type: DataTypes.INTEGER, allowNull: true },
	goal_protein_g: { type: DataTypes.INTEGER, allowNull: true },
	goal_carbs_g: { type: DataTypes.INTEGER, allowNull: true },
	goal_fat_g: { type: DataTypes.INTEGER, allowNull: true },
	goal_fiber_g: { type: DataTypes.INTEGER, allowNull: true },
	onboarding_completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
};

async function main() {
	const qi = sequelize.getQueryInterface();
	try {
		const existing = await qi.describeTable("users");
		const added = [];

		for (const [name, spec] of Object.entries(COLUMNS)) {
			if (existing[name]) continue;
			await qi.addColumn("users", name, spec);
			added.push(name);
		}

		if (added.length === 0) {
			console.log("users table already has every goal/body column - nothing to do.");
		} else {
			console.log(`Added ${added.length} column(s) to users: ${added.join(", ")}`);
		}
	} catch (err) {
		console.error("Failed to add user goal columns:", err);
		process.exitCode = 1;
	} finally {
		await sequelize.close();
	}
}

main();
