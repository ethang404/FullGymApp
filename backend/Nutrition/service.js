const WorkoutsModel = require("../models/modelInits").workouts;
const ExercisesModel = require("../models/modelInits").exercises;
const SetsModel = require("../models/modelInits").sets;
const UsersModel = require("../models/modelInits").users;

const { Op } = require("sequelize");

//error imports
const { GeneralError, NotFoundError, DataError, UnauthorizedError, ForbiddenError } = require("../error");


const toGrams = (quantity, unit, food) => {
    switch (unit) {
        case "g":       return quantity;
        case "oz":      return quantity * 28.35;
        case "serving": return quantity * food.serving_size_g;
        default:        return quantity * food.serving_size_g;
    }
};

async function getDiaryEntries(start_date, end_date, meal_type){
    //start date required, end date either remains or becomes start date if not provided
    //meal type optional. Grabs all if not passed

    //Tip: You can build where clause as you go and add to it!

    if (!start_date) throw new DataError("Start Date required for Diary Entry");
    if (!isValidDate(start_date)) throw new DataError("Start Date is not a valid date");

    if (!end_date)
        end_date = start_date

    const where = {
        logged_at: {
            [Op.between]: [start_date, end_date]
        }
    };


    if (meal_type){
        const validMeals = ["breakfast", "lunch", "dinner", "snack"];
        if (!validMeals.includes(meal_type)) throw new DataError("Invalid meal type");
        where.meal_type = meal_type;
    }

    const enteries = await DiaryEntryModel.findAll({
        where,
        include: [{
            model: FoodModel,
            include: [{ model: FoodNutrientModel }]
        }]
    });

    console.log("what does enteries look like?");
    console.log(enteries);

    
}

module.exports = {

}