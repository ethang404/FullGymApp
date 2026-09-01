const { bmrMifflinStJeor, estimateGoals } = require("../goalCalculator");

// ─────────────────────────────────────────────
// bmrMifflinStJeor — the raw formula
//   BMR = 10*kg + 6.25*cm - 5*age + (male ? +5 : -161)
// ─────────────────────────────────────────────

describe("bmrMifflinStJeor", () => {
	test("male reference value", () => {
		// 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
		expect(bmrMifflinStJeor({ sex: "male", weight_kg: 80, height_cm: 180, age: 30 })).toBeCloseTo(1780, 5);
	});

	test("female reference value", () => {
		// 10*65 + 6.25*165 - 5*25 - 161 = 650 + 1031.25 - 125 - 161 = 1395.25
		expect(bmrMifflinStJeor({ sex: "female", weight_kg: 65, height_cm: 165, age: 25 })).toBeCloseTo(1395.25, 5);
	});
});

// ─────────────────────────────────────────────
// estimateGoals — BMR → TDEE → calorie target → macro split
// ─────────────────────────────────────────────

describe("estimateGoals", () => {
	const body = {
		sex: "male",
		birth_date: "1990-01-01",
		height_cm: 180,
		weight_kg: 80,
		activity_level: "moderate", // 1.55
		goal_type: "maintain", // +0%
	};

	function ageFrom(birth_date, now = new Date()) {
		const b = new Date(birth_date + "T00:00:00Z");
		let age = now.getUTCFullYear() - b.getUTCFullYear();
		if (
			now.getUTCMonth() < b.getUTCMonth() ||
			(now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())
		) {
			age -= 1;
		}
		return age;
	}

	test("returns bmr, tdee and a full macro goal set", () => {
		const out = estimateGoals(body);

		const age = ageFrom(body.birth_date);
		const bmr = 10 * 80 + 6.25 * 180 - 5 * age + 5;
		const tdee = bmr * 1.55;

		expect(out.bmr).toBeCloseTo(bmr, 5);
		expect(out.tdee).toBeCloseTo(tdee, 5);
		expect(out.goals.calories).toBe(Math.round(tdee));
		expect(out.goals.protein).toBe(Math.round(1.8 * 80)); // 144
		expect(out.goals.fat).toBe(Math.round((out.goals.calories * 0.25) / 9));
		expect(out.goals.carbs).toBe(
			Math.max(0, Math.round((out.goals.calories - out.goals.protein * 4 - out.goals.fat * 9) / 4)),
		);
		expect(out.goals.fiber).toBe(Math.round((out.goals.calories / 1000) * 14));
	});

	test("goal_type shifts the calorie target: lose < maintain < gain", () => {
		const lose = estimateGoals({ ...body, goal_type: "lose" }).goals.calories;
		const maintain = estimateGoals({ ...body, goal_type: "maintain" }).goals.calories;
		const gain = estimateGoals({ ...body, goal_type: "gain" }).goals.calories;

		expect(lose).toBeLessThan(maintain);
		expect(gain).toBeGreaterThan(maintain);
		expect(lose).toBeCloseTo(Math.round(maintain * 0.8), -1);
		expect(gain).toBeCloseTo(Math.round(maintain * 1.1), -1);
	});

	test("higher activity level yields more calories", () => {
		const sed = estimateGoals({ ...body, activity_level: "sedentary" }).goals.calories;
		const active = estimateGoals({ ...body, activity_level: "very_active" }).goals.calories;
		expect(active).toBeGreaterThan(sed);
	});

	test("all goal values are positive integers", () => {
		const g = estimateGoals(body).goals;
		for (const v of Object.values(g)) {
			expect(Number.isInteger(v)).toBe(true);
			expect(v).toBeGreaterThan(0);
		}
	});

	test.each([
		["sex", { ...body, sex: undefined }],
		["birth_date", { ...body, birth_date: undefined }],
		["height_cm", { ...body, height_cm: undefined }],
		["weight_kg", { ...body, weight_kg: undefined }],
		["activity_level", { ...body, activity_level: undefined }],
		["goal_type", { ...body, goal_type: undefined }],
	])("throws when %s is missing", (_field, bad) => {
		expect(() => estimateGoals(bad)).toThrow();
	});

	test("throws on an unknown activity_level", () => {
		expect(() => estimateGoals({ ...body, activity_level: "olympian" })).toThrow();
	});

	test("throws on an unknown goal_type", () => {
		expect(() => estimateGoals({ ...body, goal_type: "recomp" })).toThrow();
	});

	test("thrown error carries a 400 status code (DataError)", () => {
		try {
			estimateGoals({ ...body, weight_kg: undefined });
			throw new Error("expected estimateGoals to throw");
		} catch (err) {
			expect(err.StatusCode).toBe(400);
		}
	});
});
