const { Sequelize } = require("sequelize");
const sequelize = new Sequelize(process.env.DB_CONNECTION_URL, {
	logging: process.env.NODE_ENV === "test" ? false : console.log, //added check for logging so I won't get spammed in my test cases
});
module.exports = sequelize;
