//Here I will import all the models->create relationships, and connect to neon POSTGRES database
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
	"postgresql://GymApp_owner:npg_pnNs6owleC3a@ep-divine-silence-a8bn6sww-pooler.eastus2.azure.neon.tech/GymApp?sslmode=require&channel_binding=require"
);

const users = require("./users.model")(sequelize, Sequelize.DataTypes);
const workouts = require("./workouts.model")(sequelize, Sequelize.DataTypes);
const exercises = require("./exercises.model")(sequelize, Sequelize.DataTypes);
const sets = require("./sets.model")(sequelize, Sequelize.DataTypes);
const diaryEntries = require("./diaryEntries.model")(sequelize, Sequelize.DataTypes);
const savedMeals = require("./savedMeals.model")(sequelize, Sequelize.DataTypes);
const savedMealIngred = require("./savedMealIngred.model")(sequelize, Sequelize.DataTypes);

async function testDB() {
	try {
		await sequelize.authenticate();
		console.log("Connection has been established successfully.");
		//await sequelize.sync({ force: true });
		//console.log("fuck me, calling sync");
	} catch (error) {
		console.error("Unable to connect to the database:", error);
	}
}
testDB();
defineRelationships();

//Now define our relationships
function defineRelationships() {
	//User has 1 to many workouts (put fk for user_id in workouts)
	users.hasMany(workouts, {
		foreignKey: {
			name: "user_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	workouts.belongsTo(users, {
		// Every workout must belong to a user (required). Do both for best practice, bidirection
		foreignKey: {
			name: "user_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	//workouts has 1 to many exercises (put fk for user_id in workouts)
	workouts.hasMany(exercises, {
		foreignKey: {
			name: "workout_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	exercises.belongsTo(workouts, {
		// Every exercises must belong to a workout (required). Do both for best practice, bidirection
		foreignKey: {
			name: "workout_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	//Each exercise has many sets
	exercises.hasMany(sets, {
		foreignKey: {
			name: "exercise_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	sets.belongsTo(exercises, {
		foreignKey: {
			name: "exercise_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	//user has many diaryEntries
	users.hasMany(diaryEntries, {
		foreignKey: {
			name: "user_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	diaryEntries.belongsTo(users, {
		// Every diaryEntry must belong to a user (required). Do both for best practice, bidirection
		foreignKey: {
			name: "user_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	//user has many savedMeals
	users.hasMany(savedMeals, {
		foreignKey: {
			name: "user_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	savedMeals.belongsTo(users, {
		foreignKey: {
			name: "user_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	//savedMeals has many ingrediants
	savedMeals.hasMany(savedMealIngred, {
		foreignKey: {
			name: "saved_meal_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	savedMealIngred.belongsTo(savedMeals, {
		foreignKey: {
			name: "saved_meal_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});
}

module.exports = {
	sequelize,
	users,
	workouts,
	exercises,
	sets,
	diaryEntries,
	savedMeals,
	savedMealIngred,
};
