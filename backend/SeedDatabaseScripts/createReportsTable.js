// One-off: adds the reports table to an existing database. Run once per database:
//   cd backend && node SeedDatabaseScripts/createReportsTable.js
//
// sync() on one model only creates that table if it's missing. It never touches other tables or existing data
require("dotenv").config();
const { reports } = require("../models/modelInits");
const sequelize = require("../models/db");

reports
	.sync()
	.then(() => console.log("reports table is ready"))
	.catch((error) => {
		console.error("Couldn't create the reports table:", error);
		process.exitCode = 1;
	})
	.finally(() => sequelize.close());
