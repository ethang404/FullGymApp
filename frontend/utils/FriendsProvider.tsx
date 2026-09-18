import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, type PropsWithChildren } from "react";
import { instance } from "./AxiosInterceptorHandler";
import { AuthContext } from "./AuthProvider";
import { log } from "./log";
import type { Friend, FriendRequest, UserSearchResult } from "@/app/(protected)/types/friends";

interface FriendsContextType {
	friends: Friend[];
	incomingRequests: FriendRequest[];
	outgoingRequests: FriendRequest[];
	loading: boolean;
	refresh: () => Promise<void>;
	sendRequest: (addresseeUserId: number) => Promise<void>;
	acceptRequest: (friendshipId: number) => Promise<void>;
	/** Declines an incoming request or cancels an outgoing one — same endpoint either way. */
	declineRequest: (friendshipId: number) => Promise<void>;
	removeFriend: (friendshipId: number) => Promise<void>;
	searchUsers: (query: string) => Promise<UserSearchResult[]>;
}

const FriendsContext = createContext<FriendsContextType>({
	friends: [],
	incomingRequests: [],
	outgoingRequests: [],
	loading: true,
	refresh: async () => {},
	sendRequest: async () => {
		throw new Error("FriendsProvider not mounted");
	},
	acceptRequest: async () => {
		throw new Error("FriendsProvider not mounted");
	},
	declineRequest: async () => {
		throw new Error("FriendsProvider not mounted");
	},
	removeFriend: async () => {
		throw new Error("FriendsProvider not mounted");
	},
	searchUsers: async () => {
		throw new Error("FriendsProvider not mounted");
	},
});

export function FriendsProvider({ children }: PropsWithChildren) {
	const { isValidUser } = useContext(AuthContext);
	const [friends, setFriends] = useState<Friend[]>([]);
	const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
	const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		if (!isValidUser) {
			setFriends([]);
			setIncomingRequests([]);
			setOutgoingRequests([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		try {
			const [friendsRes, incomingRes, outgoingRes] = await Promise.all([
				instance.get("/friends"),
				instance.get("/friends/requests", { params: { direction: "incoming" } }),
				instance.get("/friends/requests", { params: { direction: "outgoing" } }),
			]);
			setFriends(friendsRes.data.friends ?? []);
			setIncomingRequests(incomingRes.data.requests ?? []);
			setOutgoingRequests(outgoingRes.data.requests ?? []);
		} catch (e) {
			log.error("Failed to load friends:", e);
		} finally {
			setLoading(false);
		}
	}, [isValidUser]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const sendRequest = useCallback(
		async (addresseeUserId: number) => {
			await instance.post("/friends/requests", { addressee_user_id: addresseeUserId });
			await refresh();
		},
		[refresh],
	);

	const acceptRequest = useCallback(
		async (friendshipId: number) => {
			await instance.post(`/friends/requests/${friendshipId}/accept`);
			await refresh();
		},
		[refresh],
	);

	const declineRequest = useCallback(
		async (friendshipId: number) => {
			await instance.delete(`/friends/requests/${friendshipId}`);
			await refresh();
		},
		[refresh],
	);

	const removeFriend = useCallback(
		async (friendshipId: number) => {
			await instance.delete(`/friends/${friendshipId}`);
			await refresh();
		},
		[refresh],
	);

	const searchUsers = useCallback(async (query: string) => {
		const res = await instance.get("/friends/search", { params: { query } });
		return (res.data.results ?? []) as UserSearchResult[];
	}, []);

	const value = useMemo(
		() => ({ friends, incomingRequests, outgoingRequests, loading, refresh, sendRequest, acceptRequest, declineRequest, removeFriend, searchUsers }),
		[friends, incomingRequests, outgoingRequests, loading, refresh, sendRequest, acceptRequest, declineRequest, removeFriend, searchUsers],
	);

	return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}

export function useFriends() {
	return useContext(FriendsContext);
}
