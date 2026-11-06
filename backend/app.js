const express = require("express");
const app = express();

require("dotenv").config();
app.use(express.json());

//database creation/connection
require("./models/modelInits");

const authRoutes = require("./Auth/route");
const nutritionRoutes = require("./Nutrition/route");
const workoutRoutes = require("./Workouts/route");
const userRoutes = require("./Users/route");
const friendRoutes = require("./Friends/route");
const groupRoutes = require("./Groups/route");
const postRoutes = require("./Posts/route");
const reportRoutes = require("./Reports/route");
const { errorHandler } = require("./utils/http");

app.use("/auth", authRoutes);
app.use("/nutrition", nutritionRoutes);
app.use("/workouts", workoutRoutes);
app.use("/users", userRoutes);
app.use("/friends", friendRoutes);
app.use("/groups", groupRoutes);
app.use("/posts", postRoutes);
app.use("/reports", reportRoutes);

app.get("/", (req, res) => {
	res.send("Hello World!");
});

//has to come after every route - Express only sends errors to middleware registered after them
app.use(errorHandler);

module.exports = app; //abstracted this out so we can pas app without listening for testing using (supertest/jtest)
