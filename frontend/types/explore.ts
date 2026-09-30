// Mirrors backend/Explore/service.js's response shape — kept in sync by hand, same
// convention as macroDefaults.ts.
import type { ContentVisibility } from "./visibility";

export const EXPLORE_TYPES = ["all", "recipe", "workout"] as const;
export type ExploreType = (typeof EXPLORE_TYPES)[number];

export const EXPLORE_SCOPES = ["all", "friends", "public", "mine"] as const;
export type ExploreScope = (typeof EXPLORE_SCOPES)[number];

interface ExploreItemBase {
	id: number;
	name: string;
	visibility: ContentVisibility;
	created_at: string;
	user_id: number;
	user_name: string;
}

export interface ExploreRecipeItem extends ExploreItemBase {
	type: "recipe";
	servings: number;
	calories_per_serving: number;
	protein_per_serving: number;
	carbs_per_serving: number;
	fat_per_serving: number;
}

export interface ExploreWorkoutItem extends ExploreItemBase {
	type: "workout";
	workout_date: string;
	notes: string | null;
}

export type ExploreItem = ExploreRecipeItem | ExploreWorkoutItem;

export interface ExploreFeedResponse {
	items: ExploreItem[];
	next_cursor: string | null;
}
