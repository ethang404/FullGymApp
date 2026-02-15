//#region AddWorkoutVars
const addUserPayload = {
	firstName: "Ethan",
	lastName: "Gordon",
	userName: "egor2",
	password: "passy",
};
const addWorkoutPayload = {
	workout_name: "Push",
	workout_date: "2025-12-27",
	notes: "",
	finished_at: "2025-12-27T15:30:00Z",
	exercises: [
		{
			exercise_name: "Bench Press",
			notes: "Main compound lift",
			order_number: 1,
			sets: [
				{
					set_number: 0,
					order_number: 1,
					set_type: "warmup",
					notes: "Warmup",
					reps: 5,
					weight: 135,
				},
				{
					set_number: 1,
					order_number: 2,
					set_type: "working",
					notes: "First working set",
					reps: 5,
					weight: 185,
				},
				{
					set_number: 2,
					order_number: 3,
					set_type: "working",
					notes: "",
					reps: 5,
					weight: 185,
				},
			],
		},
		{
			exercise_name: "Incline Dumbbell Press",
			notes: "Upper chest focus",
			order_number: 2,
			sets: [
				{
					set_number: 0,
					order_number: 1,
					set_type: "warmup",
					notes: "Warmup",
					reps: 10,
					weight: 40,
				},
				{
					set_number: 1,
					order_number: 2,
					set_type: "working",
					notes: "",
					reps: 8,
					weight: 60,
				},
				{
					set_number: 2,
					order_number: 3,
					set_type: "working",
					notes: "",
					reps: 8,
					weight: 60,
				},
			],
		},
	],
};

//#endregion

//#region EditWorkoutVars

//#endregion

module.exports = { addUserPayload, addWorkoutPayload };
