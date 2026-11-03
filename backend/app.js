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

app.use("/auth", authRoutes);
app.use("/nutrition", nutritionRoutes);
app.use("/workouts", workoutRoutes);
app.use("/users", userRoutes);
app.use("/friends", friendRoutes);
app.use("/groups", groupRoutes);
app.use("/posts", postRoutes);

app.get("/", (req, res) => {
	res.send("Hello World!");
});

module.exports = app; //abstracted this out so we can pas app without listening for testing using (supertest/jtest)
