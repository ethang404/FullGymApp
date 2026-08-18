const exercises = [
	// chest
	{ name: "Barbell Bench Press", muscle_group: "chest" },
	{ name: "Incline Barbell Bench Press", muscle_group: "chest" },
	{ name: "Decline Bench Press", muscle_group: "chest" },
	{ name: "Dumbbell Bench Press", muscle_group: "chest" },
	{ name: "Incline Dumbbell Press", muscle_group: "chest" },
	{ name: "Dumbbell Flyes", muscle_group: "chest" },
	{ name: "Cable Crossover", muscle_group: "chest" },
	{ name: "Push-Up", muscle_group: "chest" },
	{ name: "Chest Dip", muscle_group: "chest" },
	{ name: "Pec Deck Machine", muscle_group: "chest" },

	// back
	{ name: "Deadlift", muscle_group: "back" },
	{ name: "Barbell Row", muscle_group: "back" },
	{ name: "Pull-Up", muscle_group: "back" },
	{ name: "Chin-Up", muscle_group: "back" },
	{ name: "Lat Pulldown", muscle_group: "back" },
	{ name: "Seated Cable Row", muscle_group: "back" },
	{ name: "T-Bar Row", muscle_group: "back" },
	{ name: "Single-Arm Dumbbell Row", muscle_group: "back" },
	{ name: "Face Pull", muscle_group: "back" },
	{ name: "Hyperextension", muscle_group: "back" },

	// shoulders
	{ name: "Overhead Press", muscle_group: "shoulders" },
	{ name: "Dumbbell Shoulder Press", muscle_group: "shoulders" },
	{ name: "Arnold Press", muscle_group: "shoulders" },
	{ name: "Lateral Raise", muscle_group: "shoulders" },
	{ name: "Front Raise", muscle_group: "shoulders" },
	{ name: "Rear Delt Fly", muscle_group: "shoulders" },
	{ name: "Upright Row", muscle_group: "shoulders" },
	{ name: "Shrugs", muscle_group: "shoulders" },
	{ name: "Cable Lateral Raise", muscle_group: "shoulders" },
	{ name: "Landmine Press", muscle_group: "shoulders" },

	// biceps
	{ name: "Barbell Curl", muscle_group: "biceps" },
	{ name: "Dumbbell Curl", muscle_group: "biceps" },
	{ name: "Hammer Curl", muscle_group: "biceps" },
	{ name: "Preacher Curl", muscle_group: "biceps" },
	{ name: "Concentration Curl", muscle_group: "biceps" },
	{ name: "Cable Curl", muscle_group: "biceps" },
	{ name: "EZ Bar Curl", muscle_group: "biceps" },
	{ name: "Incline Dumbbell Curl", muscle_group: "biceps" },

	// triceps
	{ name: "Close-Grip Bench Press", muscle_group: "triceps" },
	{ name: "Tricep Pushdown", muscle_group: "triceps" },
	{ name: "Overhead Tricep Extension", muscle_group: "triceps" },
	{ name: "Skull Crushers", muscle_group: "triceps" },
	{ name: "Tricep Dip", muscle_group: "triceps" },
	{ name: "Tricep Kickback", muscle_group: "triceps" },
	{ name: "Diamond Push-Up", muscle_group: "triceps" },

	// legs
	{ name: "Barbell Squat", muscle_group: "legs" },
	{ name: "Front Squat", muscle_group: "legs" },
	{ name: "Leg Press", muscle_group: "legs" },
	{ name: "Romanian Deadlift", muscle_group: "legs" },
	{ name: "Bulgarian Split Squat", muscle_group: "legs" },
	{ name: "Walking Lunge", muscle_group: "legs" },
	{ name: "Leg Extension", muscle_group: "legs" },
	{ name: "Leg Curl", muscle_group: "legs" },
	{ name: "Standing Calf Raise", muscle_group: "legs" },
	{ name: "Hack Squat", muscle_group: "legs" },
	{ name: "Goblet Squat", muscle_group: "legs" },

	// glutes
	{ name: "Hip Thrust", muscle_group: "glutes" },
	{ name: "Glute Bridge", muscle_group: "glutes" },
	{ name: "Cable Glute Kickback", muscle_group: "glutes" },
	{ name: "Sumo Deadlift", muscle_group: "glutes" },
	{ name: "Step-Up", muscle_group: "glutes" },

	// core
	{ name: "Plank", muscle_group: "core" },
	{ name: "Side Plank", muscle_group: "core" },
	{ name: "Crunch", muscle_group: "core" },
	{ name: "Hanging Leg Raise", muscle_group: "core" },
	{ name: "Russian Twist", muscle_group: "core" },
	{ name: "Ab Wheel Rollout", muscle_group: "core" },
	{ name: "Cable Woodchopper", muscle_group: "core" },
	{ name: "Sit-Up", muscle_group: "core" },
	{ name: "Mountain Climber", muscle_group: "core" },

	// full_body
	{ name: "Clean and Jerk", muscle_group: "full_body" },
	{ name: "Snatch", muscle_group: "full_body" },
	{ name: "Kettlebell Swing", muscle_group: "full_body" },
	{ name: "Thruster", muscle_group: "full_body" },
	{ name: "Farmer's Carry", muscle_group: "full_body" },
	{ name: "Burpee", muscle_group: "full_body" },
	{ name: "Turkish Get-Up", muscle_group: "full_body" },

	// cardio
	{ name: "Treadmill Running", muscle_group: "cardio" },
	{ name: "Rowing Machine", muscle_group: "cardio" },
	{ name: "Stationary Bike", muscle_group: "cardio" },
	{ name: "Jump Rope", muscle_group: "cardio" },
	{ name: "Elliptical", muscle_group: "cardio" },
	{ name: "Stair Climber", muscle_group: "cardio" },
	{ name: "Swimming", muscle_group: "cardio" },
];

module.exports = exercises;
