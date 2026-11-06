//Here I will import all the models->create relationships, and connect to neon POSTGRES database
const users = require("./users.model");
const workouts = require("./workouts.model");
const exercises = require("./exercises.model");
const sets = require("./sets.model");
const { diaryEntries } = require("./diaryEntries.model");
const recipe = require("./recipe.model");
const recipeIngredient = require("./recipeIngredient.model");
const friendships = require("./friendships.model");
const friend_permissions = require("./friend_permissions.model");
const blocked_users = require("./blocked.model");
const groups = require("./groups.model");
const group_members = require("./group_members.model");
const posts = require("./posts.model");
const post_comments = require("./post_comments.model");
const post_likes = require("./post_likes.model");
const reports = require("./reports.model");

const exercise_catalog = require("./exerciseCatalog");

const { food } = require("./food.model");
const foodNutrient = require("./foodNutrients.model");
const foodServingSize = require("./foodServingSize.model");

const sequelize = require("./db");

//for database seeding
const exercisesSeededList = require("../SeedDatabaseScripts/tempExercises");
async function seedExerciseCatalog() {
	await exercise_catalog.bulkCreate(exercisesSeededList, {
		ignoreDuplicates: true, // skips rows that violate a unique constraint instead of throwing
	});
	console.log(`Seeded ${exercisesSeededList.length} exercises (duplicates skipped).`);
}

//Scripts for seeing database
// The scripts are required lazily (inside run) because they import this file - requiring them at the
// top would be circular and they'd get an empty module.
const DB_SEED_SCRIPTS = [
	{ flag: "SEED_EXERCISES", run: seedExerciseCatalog }, //full exercise catalog
	{ flag: "SEED_DEMO_DATA", run: () => require("../SeedDatabaseScripts/seedDemoData").seedDemoData() }, //ethan/alice/bob demo users with everything (catalog included)
];

async function runBootScripts() {
	if (process.env.NODE_ENV === "test" || require.main?.filename.includes("SeedDatabaseScripts")) return;

	for (const { flag, run } of DB_SEED_SCRIPTS) {
		if (process.env[flag] !== "true") continue;
		try {
			console.log(`${flag}=true: running...`);
			await run();
		} catch (error) {
			//one failing shouldn't stop the rest (or the server) from starting
			console.error(`${flag} failed:`, error);
		}
	}
}

async function testDB() {
	try {
		await sequelize.authenticate();
		console.log("Connection has been established successfully.");
		//await sequelize.sync({ force: true });
	} catch (error) {
		console.error("Unable to connect to the database:", error);
		return;
	}
	await runBootScripts();
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

	//exercises is constrained to exercise_catalog
	exercise_catalog.hasMany(exercises, {
		foreignKey: {
			name: "catalog_id",
			allowNull: false,
		},
		onDelete: "RESTRICT",
	});

	exercises.belongsTo(exercise_catalog, {
		foreignKey: {
			name: "catalog_id",
			allowNull: false,
		},
		onDelete: "RESTRICT",
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

	food.hasMany(diaryEntries, {
		foreignKey: {
			name: "food_id",
		},
		onDelete: "CASCADE",
	});

	diaryEntries.belongsTo(food, {
		foreignKey: {
			name: "food_id",
		},
	});

	//diary entries can have reciepe or food
	diaryEntries.belongsTo(recipe, { foreignKey: "recipe_id" });
	recipe.hasMany(diaryEntries, { foreignKey: "recipe_id" });

	//ReciepeIngrediants are foods
	recipeIngredient.belongsTo(food, { foreignKey: "food_id" });
	food.hasMany(recipeIngredient, { foreignKey: "food_id" });

	//user has many recipe
	users.hasMany(recipe, {
		foreignKey: {
			name: "user_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	recipe.belongsTo(users, {
		foreignKey: {
			name: "user_id",
			allowNull: false,
		},
	});

	//recipe has many ingrediants
	recipe.hasMany(recipeIngredient, {
		foreignKey: {
			name: "recipe_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	recipeIngredient.belongsTo(recipe, {
		foreignKey: {
			name: "recipe_id",
			allowNull: false,
		},
	});

	//User has many submitted food
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

	//food has many food serving sizes
	food.hasMany(foodServingSize, {
		foreignKey: {
			name: "food_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	foodServingSize.belongsTo(food, {
		foreignKey: {
			name: "food_id",
			allowNull: false,
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

	//friendships is self-referential on users via two FKs (always stored user_id_a < user_id_b) plus
	//requested_by to track who sent the request. We link each FK to users table so it's in the include for us
	//so we can extract name.
	//Without the alias, sequelize doesn't know which FK to join on for include since we have multiple
	friendships.belongsTo(users, { as: "userA", onDelete: "CASCADE", foreignKey: { name: "user_id_a", allowNull: false } });
	friendships.belongsTo(users, { as: "userB", onDelete: "CASCADE", foreignKey: { name: "user_id_b", allowNull: false } });
	friendships.belongsTo(users, { as: "requester", onDelete: "CASCADE", foreignKey: { name: "requested_by", allowNull: false } });

	//friendship has up to 2 share rows (one per side). Unfriending -> share settings go with it
	friendships.hasMany(friend_permissions, {
		as: "permissions",
		foreignKey: {
			name: "friendship_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	friend_permissions.belongsTo(friendships, {
		foreignKey: {
			name: "friendship_id",
			allowNull: false,
		},
	});

	//user owns many permissions (one per friend)
	users.hasMany(friend_permissions, {
		as: "friendPermissions",
		foreignKey: {
			name: "owner_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	friend_permissions.belongsTo(users, {
		as: "owner",
		foreignKey: {
			name: "owner_id",
			allowNull: false,
		},
	});

	//blocked_users has two FKs to users (blocker + blocked), so both sides are aliased.
	//Either user deleting their account removes the block
	users.hasMany(blocked_users, {
		as: "blocks",
		foreignKey: {
			name: "blocker_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	blocked_users.belongsTo(users, {
		as: "blocker",
		foreignKey: {
			name: "blocker_id",
			allowNull: false,
		},
	});

	users.hasMany(blocked_users, {
		as: "blockedBy",
		foreignKey: {
			name: "blocked_user_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	blocked_users.belongsTo(users, {
		as: "blockedUser",
		foreignKey: {
			name: "blocked_user_id",
			allowNull: false,
		},
	});

	//user creates many groups. SET NULL so deleting the creator keeps the group alive for other members
	users.hasMany(groups, {
		as: "createdGroups",
		foreignKey: {
			name: "created_by",
			allowNull: true,
		},
		onDelete: "SET NULL",
	});

	groups.belongsTo(users, {
		as: "creator",
		foreignKey: {
			name: "created_by",
			allowNull: true,
		},
		onDelete: "SET NULL",
	});

	//group has many members (join table between groups and users)
	groups.hasMany(group_members, {
		as: "memberships",
		foreignKey: {
			name: "group_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	group_members.belongsTo(groups, {
		foreignKey: {
			name: "group_id",
			allowNull: false,
		},
	});

	//user has many group memberships
	users.hasMany(group_members, {
		as: "groupMemberships",
		foreignKey: {
			name: "user_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	//aliased since group_members has two FKs to users (member + inviter)
	group_members.belongsTo(users, {
		as: "user",
		foreignKey: {
			name: "user_id",
			allowNull: false,
		},
	});

	group_members.belongsTo(users, {
		as: "inviter",
		foreignKey: {
			name: "invited_by",
			allowNull: true,
		},
		onDelete: "SET NULL",
	});

	//https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/

	//many-to-many shortcuts so services can do givenGroup.getMembers() / givenUser.getGroups() or include either side
	//Basically instead of doing .belongsTo and hasMany from users->groups->groupMembers, we can do it like this
	//through junction table (group_members)
	groups.belongsToMany(users, { through: group_members, as: "members", foreignKey: "group_id", otherKey: "user_id" });
	users.belongsToMany(groups, { through: group_members, as: "groups", foreignKey: "user_id", otherKey: "group_id" });

	//user has many posts
	users.hasMany(posts, {
		foreignKey: {
			name: "user_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	posts.belongsTo(users, {
		foreignKey: {
			name: "user_id",
			allowNull: false,
		},
	});

	//group has many posts-when id not null. Group deleted -> its posts go with it
	groups.hasMany(posts, {
		foreignKey: {
			name: "group_id",
			allowNull: true,
		},
		onDelete: "CASCADE",
	});

	posts.belongsTo(groups, {
		foreignKey: {
			name: "group_id",
			allowNull: true,
		},
	});

	//a post can share a workout, a recipe, or a diary entry.
	//Deleting the shared workout/recipe/diary entry deletes the post - nothing left to show
	workouts.hasMany(posts, {
		foreignKey: {
			name: "workout_id",
			allowNull: true,
		},
		onDelete: "CASCADE",
	});

	posts.belongsTo(workouts, {
		foreignKey: {
			name: "workout_id",
			allowNull: true,
		},
	});

	recipe.hasMany(posts, {
		foreignKey: {
			name: "recipe_id",
			allowNull: true,
		},
		onDelete: "CASCADE",
	});

	posts.belongsTo(recipe, {
		foreignKey: {
			name: "recipe_id",
			allowNull: true,
		},
	});

	diaryEntries.hasMany(posts, {
		foreignKey: {
			name: "diary_log_id",
			allowNull: true,
		},
		onDelete: "CASCADE",
	});

	posts.belongsTo(diaryEntries, {
		as: "diaryEntry",
		foreignKey: {
			name: "diary_log_id",
			allowNull: true,
		},
	});

	//post has many comments
	posts.hasMany(post_comments, {
		as: "comments",
		foreignKey: {
			name: "post_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	post_comments.belongsTo(posts, {
		foreignKey: {
			name: "post_id",
			allowNull: false,
		},
	});

	//user has many comments
	users.hasMany(post_comments, {
		foreignKey: {
			name: "user_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	post_comments.belongsTo(users, {
		foreignKey: {
			name: "user_id",
			allowNull: false,
		},
	});

	//post has many likes
	posts.hasMany(post_likes, {
		as: "likes",
		foreignKey: {
			name: "post_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	post_likes.belongsTo(posts, {
		foreignKey: {
			name: "post_id",
			allowNull: false,
		},
	});

	//user has many likes
	users.hasMany(post_likes, {
		foreignKey: {
			name: "user_id",
			allowNull: false,
		},
		onDelete: "CASCADE",
	});

	post_likes.belongsTo(users, {
		foreignKey: {
			name: "user_id",
			allowNull: false,
		},
	});

	//reports only link to users. target_id has no association, see reports.model.js
	//SET NULL (not CASCADE) so a report survives either person deleting their account
	users.hasMany(reports, {
		as: "reportsFiled",
		foreignKey: {
			name: "reporter_id",
			allowNull: true,
		},
		onDelete: "SET NULL",
	});

	reports.belongsTo(users, {
		as: "reporter",
		foreignKey: {
			name: "reporter_id",
			allowNull: true,
		},
	});

	users.hasMany(reports, {
		as: "reportsAgainst",
		foreignKey: {
			name: "reported_user_id",
			allowNull: true,
		},
		onDelete: "SET NULL",
	});

	reports.belongsTo(users, {
		as: "reportedUser",
		foreignKey: {
			name: "reported_user_id",
			allowNull: true,
		},
	});
}

module.exports = {
	users,
	workouts,
	exercises,
	exercise_catalog,
	sets,
	diaryEntries,
	recipe,
	recipeIngredient,
	food,
	foodNutrient,
	foodServingSize,
	friendships,
	friend_permissions,
	blocked_users,
	groups,
	group_members,
	posts,
	post_comments,
	post_likes,
	reports,
};
