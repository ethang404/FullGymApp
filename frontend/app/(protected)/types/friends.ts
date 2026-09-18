// Mirror of backend/Friends/service.js response shapes — kept in sync by hand since
// there is no shared package (same convention as macroDefaults.ts).

export const FRIENDSHIP_STATUSES = ["pending", "accepted"] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number];

export type RequestDirection = "incoming" | "outgoing";

export const RELATIONSHIP_STATES = ["none", "pending_outgoing", "pending_incoming", "friends"] as const;
export type RelationshipState = (typeof RELATIONSHIP_STATES)[number];

export interface Friend {
	friendship_id: number;
	user_id: number;
	user_name: string;
	first_name: string | null;
	last_name: string | null;
	since: string; // ISO timestamp
}

export interface FriendRequest {
	friendship_id: number;
	user_id: number;
	user_name: string;
	first_name: string | null;
	last_name: string | null;
	requested_at: string; // ISO timestamp
}

export interface UserSearchResult {
	user_id: number;
	user_name: string;
	first_name: string | null;
	last_name: string | null;
	relationship: RelationshipState;
}

/** "First Last" if either name is set, else falls back to "@username". */
export function displayName(person: { first_name: string | null; last_name: string | null; user_name: string }): string {
	const full = [person.first_name, person.last_name].filter(Boolean).join(" ");
	return full || person.user_name;
}
