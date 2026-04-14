const service = require("./service");
const jwt = require("jsonwebtoken");

function getUserId(req) {
	const accessToken = req.headers.authorization.split(" ")[1];
	const user = jwt.verify(accessToken, process.env.JWT_SECRET, {
		audience: "my-gym-app",
		issuer: "gym-auth-server",
	});
	return user.user_id;
}

//ex: /foods?query=chicken
async function searchFoods(req, res) {
	const { query } = req.query;
	try {
		const foods = await service.SearchFoods(query);
		return res.status(200).json({ foods });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

async function createFood(req, res) {
	const user_id = getUserId(req);
	try {
		const food = await service.CreateFood(req.body, user_id);
		return res.status(201).json({ food });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

//Aggregate Diary enteries

//What's important for query...
//on a specific date, get all meals
//on a specific date, get a certain type of meal
//for a time frame of dates get all meals
//for a time frame of dates get a certain type of meal

async function getDiaryEntries(req, res){
	const {begin_date, end_date, meal} = req.query
	try {
		const food = await service.getDiaryEntries(begin_date, end_date, meal);
		return res.status(201).json({ food });
	} catch (error) {
		if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
		return res.status(500).json({ message: error.message });
	}
}

//(type of meal == breaktis or something)

module.exports = { searchFoods, createFood, getDiaryEntries };
