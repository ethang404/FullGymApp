const express = require("express");
const app = express();
const router = express.Router();

require("dotenv").config();
app.use(express.json());
const port = process.env.PORT;

//database creation/connection
const db = require("./models/modelInits");

const authRoutes = require("./Auth/route");
const nutritionRoutes = require("./Nutrition/route");
//const workoutRoutes = require("./Workouts/route");

app.use("/auth", authRoutes);
app.use("/nutrition", nutritionRoutes);
//app.use("/workout", workoutRoutes);

app.get("/", (req, res) => {
	res.send("Hello World!");
});

app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
