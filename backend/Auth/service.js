const jwt = require("jsonwebtoken");

const usersDB = require("../models/modelInits").users;

async function test() {
	console.log("This is my function in service");
	const users = await usersDB.findAll();
	console.log("All users:", JSON.stringify(users, null, 2));
	return JSON.stringify(users, null, 2);
}

function refreshToken(refreshToken) {
	const user = jwt.verify(refreshToken, process.env.JWT_SECRET, {
		audience: "my-gym-app",
		issuer: "gym-auth-server",
	});
	const accessToken = jwt.sign({ user_id: user.user_id }, process.env.JWT_SECRET, {
		expiresIn: "1h",
		audience: "my-gym-app",
		issuer: "gym-auth-server",
	});
	return accessToken;
	//assuming refreshToken is valid (hit catch outside this function if not)
}

function generateTokens(user_id) {
	const accessToken = jwt.sign({ user_id: user_id }, process.env.JWT_SECRET, {
		expiresIn: "1h",
		audience: "my-gym-app",
		issuer: "gym-auth-server",
	});
	const refreshToken = jwt.sign({ user_id: user_id }, process.env.JWT_SECRET, {
		expiresIn: "30 days",
		audience: "my-gym-app",
		issuer: "gym-auth-server",
	});
	return {
		accessToken,
		refreshToken,
	};
}

async function register(userData) {
	const goku = await usersDB.create({
		first_name: userData.firstName,
		last_name: userData.lastName,
		user_name: userData.userName,
		password: userData.password, //salt/pepper this with bcrypt..or do in controller maybe
	});
	console.log(goku);
	return goku;
	/* const goku = await User.create({
		firstName: "Goku",
		lastName: "Gordon",
		user_name: "GokuGod44",
		password: "123",
	}); */
	//console.log("Jane's auto-generated ID:", jane.id);
}

async function login(username) {
	const user = await usersDB.findOne({ where: { user_name: username } });
	if (!user) return null;
	return user;
}

module.exports = { test, register, refreshToken, login, generateTokens };
