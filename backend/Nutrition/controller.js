const service = require("./service");
const jwt = require("jsonwebtoken");

async function searchFoods(req, res) {
    const {food} = req.query;// endpoint?food=blah

    try{
            let foods = await service.SearchFoods(food);
            return res.status(200).json({ foods });
    } catch (error) {
            if (error.StatusCode) return res.status(error.StatusCode).json({ message: error.message });
            return res.status(500).json({ message: error.message });
    }
}

module.exports = { searchFoods }