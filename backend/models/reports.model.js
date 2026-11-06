const { DataTypes } = require("sequelize");
const sequelize = require("./db");
const { REPORT_TARGET_TYPES, REPORT_REASONS, REPORT_STATUSES } = require("../constants");

// One row per person reporting a thing (post/comment/group/user/food)
//
// target_type + target_id say what was reported. target_id has NO foreign key!
// target_id is just a integer that maps to a row in another table, based on target_type
// keep reports past deletion of account
const reports = sequelize.define(
	"reports",
	{
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		reporter_id: {
			//foreign key, null once the reporter deletes their account
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		reported_user_id: {
			//foreign key, whoever is responsible for the target
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		target_type: {
			type: DataTypes.ENUM(...REPORT_TARGET_TYPES),
			allowNull: false,
		},
		target_id: {
			//not a foreign key...just number
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		reason: {
			type: DataTypes.ENUM(...REPORT_REASONS),
			allowNull: false,
		},
		note: {
			//optional extra detail from the reporter
			type: DataTypes.STRING(500),
			allowNull: true,
		},
		content_snapshot: {
			//the target as it was when reported, since it can be edited or deleted afterwards
			type: DataTypes.JSONB,
			allowNull: false,
		},
		status: {
			type: DataTypes.ENUM(...REPORT_STATUSES),
			allowNull: false,
			defaultValue: "open",
		},
		resolved_at: {
			type: DataTypes.DATE,
			allowNull: true,
		},
	},
	{
		tableName: "reports",
		timestamps: true,
		underscored: true,
		indexes: [
			{ unique: true, fields: ["reporter_id", "target_type", "target_id"] }, //one report per person per target
			{ fields: ["status", "created_at"] }, //admin queue
			{ fields: ["reported_user_id"] }, //everything reported about one person
			{ fields: ["target_type", "target_id"] }, //every report on one target
		],
	},
);

module.exports = reports;
