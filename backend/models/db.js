const { Sequelize } = require("sequelize");
const sequelize = new Sequelize(process.env.DB_CONNECTION_URL);
module.exports = sequelize;
