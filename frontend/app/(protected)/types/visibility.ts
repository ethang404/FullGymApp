// Mirrors the backend's visibility enums (workouts.model.js / recipe.model.js /
// diaryEntries.model.js) — kept in sync by hand, same convention as macroDefaults.ts.
// Shared by recipes, workouts, and diary entries so all three visibility selectors
// (CreateRecipe, [workout_id], LogFoodModal) draw from one place.

export const CONTENT_VISIBILITIES = ["private", "friends", "public"] as const;
export type ContentVisibility = (typeof CONTENT_VISIBILITIES)[number];

// Diary entries never go fully public - only "friends" or "private".
export const DIARY_VISIBILITIES = ["friends", "private"] as const;
export type DiaryVisibility = (typeof DIARY_VISIBILITIES)[number];

export const CONTENT_VISIBILITY_LABELS: Record<ContentVisibility, string> = {
	private: "Private",
	friends: "Friends",
	public: "Public",
};

export const DIARY_VISIBILITY_LABELS: Record<DiaryVisibility, string> = {
	friends: "Friends",
	private: "Private",
};
