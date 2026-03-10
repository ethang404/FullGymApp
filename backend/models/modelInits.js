//Here I will import all the models->create relationships, and connect to neon POSTGRES database
const users = require("./users.model");
const workouts = require("./workouts.model");
const exercises = require("./exercises.model");
const sets = require("./sets.model");
const diaryEntries = require("./diaryEntries.model");
const savedMeals = require("./savedMeals.model");
const savedMealIngred = require("./savedMealIngred.model");

const { food } = require("./food.model");
const foodNutrient = require("./foodNutrients.model");

const sequelize = require("./db");

async function testDB() {
	try {
		await sequelize.authenticate();
		console.log("Connection has been established successfully.");
		//await sequelize.sync({ force: true }); //this forces remote db to sync to what we have here (wipes data)
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
	});

	//User has many submitted foods
	users.hasMany(food, {
		foreignKey: {
			name: "submitted_by",
			allowNull: true,
		},
	});

	food.belongsTo(users, {
		foreignKey: {
			name: "submitted_by",
			allowNull: true,
		},
	});

	//food has many food nutrients
	food.hasMany(foodNutrient, {
		foreignKey: {
			name: "food_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	foodNutrient.belongsTo(food, {
		foreignKey: {
			name: "food_id",
			allowNull: false,
		},
	});
}

module.exports = {
	users,
	workouts,
	exercises,
	sets,
	diaryEntries,
	savedMeals,
	savedMealIngred,
	food,
	foodNutrient,
};
