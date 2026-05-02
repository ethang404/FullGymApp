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
				{ order_number: 1, set_type: "warmup",  notes: "Warmup",            reps: 5, weight: 135 },
				{ order_number: 2, set_type: "working", notes: "First working set", reps: 5, weight: 185 },
				{ order_number: 3, set_type: "working", notes: "",                  reps: 5, weight: 185 },
			],
		},
		{
			exercise_name: "Incline Dumbbell Press",
			notes: "Upper chest focus",
			order_number: 2,
			sets: [
				{ order_number: 1, set_type: "warmup",  notes: "Warmup", reps: 10, weight: 40 },
				{ order_number: 2, set_type: "working", notes: "",        reps: 8,  weight: 60 },
				{ order_number: 3, set_type: "working", notes: "",        reps: 8,  weight: 60 },
			],
		},
	],
};
//#endregion

//#region EditWorkoutVars
const editWorkoutPayloads = [
	// 1. Simple workout rename + add notes
	{
		workout_name: "Push Day A",
		workout_date: "2025-12-27",
		notes: "Felt strong today",
		finished_at: "2025-12-27T15:30:00Z",
		exercises: [
			{
				exercise_id: 1,
				exercise_name: "Bench Press",
				notes: "Main compound lift",
				order_number: 1,
				sets: [
					{ set_id: 1, order_number: 1, set_type: "warmup",  notes: "Warmup",            reps: 5, weight: 135 },
					{ set_id: 2, order_number: 2, set_type: "working", notes: "First working set", reps: 5, weight: 185 },
					{ set_id: 3, order_number: 3, set_type: "working", notes: "",                  reps: 5, weight: 185 },
				],
			},
			{
				exercise_id: 2,
				exercise_name: "Incline Dumbbell Press",
				notes: "Upper chest focus",
				order_number: 2,
				sets: [
					{ set_id: 4, order_number: 1, set_type: "warmup",  notes: "Warmup", reps: 10, weight: 40 },
					{ set_id: 5, order_number: 2, set_type: "working", notes: "",        reps: 8,  weight: 60 },
					{ set_id: 6, order_number: 3, set_type: "working", notes: "",        reps: 8,  weight: 60 },
				],
			},
		],
	},
	// 2. Update reps and weight on several sets
	{
		workout_name: "Push Day A",
		workout_date: "2025-12-27",
		notes: "Felt strong today",
		finished_at: "2025-12-27T15:30:00Z",
		exercises: [
			{
				exercise_id: 1,
				exercise_name: "Bench Press",
				notes: "Main compound lift",
				order_number: 1,
				sets: [
					{ set_id: 1, order_number: 1, set_type: "warmup",  notes: "Warmup",            reps: 5, weight: 145 },
					{ set_id: 2, order_number: 2, set_type: "working", notes: "First working set", reps: 5, weight: 195 },
					{ set_id: 3, order_number: 3, set_type: "working", notes: "",                  reps: 5, weight: 195 },
				],
			},
			{
				exercise_id: 2,
				exercise_name: "Incline Dumbbell Press",
				notes: "Upper chest focus",
				order_number: 2,
				sets: [
					{ set_id: 4, order_number: 1, set_type: "warmup",  notes: "Warmup", reps: 10, weight: 40 },
					{ set_id: 5, order_number: 2, set_type: "working", notes: "",        reps: 10, weight: 65 },
					{ set_id: 6, order_number: 3, set_type: "working", notes: "",        reps: 10, weight: 65 },
				],
			},
		],
	},
	// 3. Add a new set to Bench Press (no set_id since it's new)
	{
		workout_name: "Push Day A",
		workout_date: "2025-12-27",
		notes: "Added an extra set",
		finished_at: "2025-12-27T15:30:00Z",
		exercises: [
			{
				exercise_id: 1,
				exercise_name: "Bench Press",
				notes: "Main compound lift",
				order_number: 1,
				sets: [
					{ set_id: 1, order_number: 1, set_type: "warmup",  notes: "Warmup",            reps: 5, weight: 145 },
					{ set_id: 2, order_number: 2, set_type: "working", notes: "First working set", reps: 5, weight: 195 },
					{ set_id: 3, order_number: 3, set_type: "working", notes: "",                  reps: 5, weight: 195 },
					{            order_number: 4, set_type: "working", notes: "Extra set",          reps: 5, weight: 195 },
				],
			},
			{
				exercise_id: 2,
				exercise_name: "Incline Dumbbell Press",
				notes: "Upper chest focus",
				order_number: 2,
				sets: [
					{ set_id: 4, order_number: 1, set_type: "warmup",  notes: "Warmup", reps: 10, weight: 40 },
					{ set_id: 5, order_number: 2, set_type: "working", notes: "",        reps: 10, weight: 65 },
					{ set_id: 6, order_number: 3, set_type: "working", notes: "",        reps: 10, weight: 65 },
				],
			},
		],
	},
	// 4. Add a new exercise (no exercise_id since it's new)
	{
		workout_name: "Push Day A",
		workout_date: "2025-12-27",
		notes: "Added tricep work",
		finished_at: "2025-12-27T15:30:00Z",
		exercises: [
			{
				exercise_id: 1,
				exercise_name: "Bench Press",
				notes: "Main compound lift",
				order_number: 1,
				sets: [
					{ set_id: 1, order_number: 1, set_type: "warmup",  notes: "Warmup",            reps: 5, weight: 145 },
					{ set_id: 2, order_number: 2, set_type: "working", notes: "First working set", reps: 5, weight: 195 },
					{ set_id: 3, order_number: 3, set_type: "working", notes: "",                  reps: 5, weight: 195 },
					{            order_number: 4, set_type: "working", notes: "Extra set",          reps: 5, weight: 195 },
				],
			},
			{
				exercise_id: 2,
				exercise_name: "Incline Dumbbell Press",
				notes: "Upper chest focus",
				order_number: 2,
				sets: [
					{ set_id: 4, order_number: 1, set_type: "warmup",  notes: "Warmup", reps: 10, weight: 40 },
					{ set_id: 5, order_number: 2, set_type: "working", notes: "",        reps: 10, weight: 65 },
					{ set_id: 6, order_number: 3, set_type: "working", notes: "",        reps: 10, weight: 65 },
				],
			},
			{
				exercise_name: "Tricep Pushdown",
				notes: "Isolation finisher",
				order_number: 3,
				sets: [
					{ order_number: 1, set_type: "working", notes: "", reps: 12, weight: 50 },
					{ order_number: 2, set_type: "working", notes: "", reps: 12, weight: 50 },
				],
			},
		],
	},
];
//#endregion

//#region NutritionVars

// Food payload - now includes serving_sizes instead of serving_size_g/serving_size_label
const addFoodPayload = {
	name: "Chicken Breast",
	brand: "Generic",
	barcode: null,
	nutrients: [
		{ nutrient_id: 1008, nutrient_name: "Energy",                    unit: "kcal", amount_per_100g: 165 },
		{ nutrient_id: 1003, nutrient_name: "Protein",                   unit: "g",    amount_per_100g: 31  },
		{ nutrient_id: 1005, nutrient_name: "Carbohydrate, by difference", unit: "g",  amount_per_100g: 0   },
		{ nutrient_id: 1004, nutrient_name: "Total lipid (fat)",          unit: "g",   amount_per_100g: 3.6 },
	],
	serving_sizes: [
		{ label: "serving", weight_g: 140 }, // 1 serving = 140g chicken breast
		{ label: "oz",      weight_g: 28.35 },
	],
};

// Diary entry - uses "g" so no food_serving_sizes lookup needed
const addDiaryEntryPayload = {
	food_id: null, // set dynamically in test after food is created
	meal_type: "lunch",
	logged_at: "2025-01-15",
	quantity: 200,
	unit: "g",
};

// Edit diary entry - also uses "g"
const editDiaryEntryPayload = {
	quantity: 150,
	unit: "g",
	meal_type: "dinner",
	logged_at: "2025-01-15",
};

// Diary entry using a named serving size (tests food_serving_sizes lookup)
const addDiaryEntryServingPayload = {
	food_id: null, // set dynamically
	meal_type: "dinner",
	logged_at: "2025-01-15",
	quantity: 2,
	unit: "serving", // 2 servings = 2 * 140g = 280g
};
//#endregion

//#region RecipeVars
const createRecipePayload = {
	name: "High Protein Lunch",
	description: "Simple high protein meal",
	servings: 2, // this recipe makes 2 servings
	ingredients: [
		{
			food_id: null, // set dynamically after food is created
			quantity: 200,
			unit: "g",
		},
	],
};
//#endregion

module.exports = {
	// Workout
	addUserPayload,
	editWorkoutPayloads,
	addWorkoutPayload,
	// Nutrition
	addFoodPayload,
	addDiaryEntryPayload,
	editDiaryEntryPayload,
	addDiaryEntryServingPayload,
	createRecipePayload,
};
