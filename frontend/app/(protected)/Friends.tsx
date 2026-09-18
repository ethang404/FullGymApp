import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { useMemo, useState, useCallback } from "react";
import { router, useFocusEffect, type Href } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { log } from "@/utils/log";
import { toast } from "@/utils/toast";
import { ScreenState } from "@/components/ScreenState";
import Screen from "@/components/Screen";
import SegmentedControl from "@/components/SegmentedControl";
import { useFriends } from "@/utils/FriendsProvider";
import { useFriendSearch } from "./friends/hooks/useFriendSearch";
import FriendRequestRow from "./friends/components/FriendRequestRow";
import FriendListRow from "./friends/components/FriendListRow";
import SearchResultRow from "./friends/components/SearchResultRow";
import type { Friend, RequestDirection, UserSearchResult } from "./types/friends";

export default function Friends() {
	const { theme } = useTheme();
	const { friends, incomingRequests, outgoingRequests, loading, refresh, sendRequest, acceptRequest, declineRequest, removeFriend } = useFriends();
	const { query, setQuery, results: searchResults, loading: searching } = useFriendSearch();

	const [refreshing, setRefreshing] = useState(false);
	const [pendingTab, setPendingTab] = useState<RequestDirection>("incoming");
	const [busyFriendshipId, setBusyFriendshipId] = useState<number | null>(null);
	const [busyUserId, setBusyUserId] = useState<number | null>(null);

	useFocusEffect(
		useCallback(() => {
			refresh();
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, []),
	);

	const isSearching = query.trim().length > 0;

	async function handleAccept(friendshipId: number) {
		setBusyFriendshipId(friendshipId);
		try {
			await acceptRequest(friendshipId);
			toast.success("Friend request accepted");
		} catch (e) {
			log.error("Accept request failed:", e);
			toast.error("Couldn't accept the request. Try again.");
		} finally {
			setBusyFriendshipId(null);
		}
	}

	async function handleDecline(friendshipId: number, direction: RequestDirection) {
		setBusyFriendshipId(friendshipId);
		try {
			await declineRequest(friendshipId);
			toast.success(direction === "incoming" ? "Request declined" : "Request cancelled");
		} catch (e) {
			log.error("Decline/cancel request failed:", e);
			toast.error("Couldn't update the request. Try again.");
		} finally {
			setBusyFriendshipId(null);
		}
	}

	function confirmRemove(friend: Friend) {
		Alert.alert("Remove friend?", `${friend.user_name} will be removed from your friends list.`, [
			{ text: "Cancel", style: "cancel" },
			{ text: "Remove", style: "destructive", onPress: () => handleRemove(friend) },
		]);
	}

	async function handleRemove(friend: Friend) {
		setBusyFriendshipId(friend.friendship_id);
		try {
			await removeFriend(friend.friendship_id);
			toast.success(`Removed ${friend.user_name} from friends`);
		} catch (e) {
			log.error("Remove friend failed:", e);
			toast.error("Couldn't remove this friend. Try again.");
		} finally {
			setBusyFriendshipId(null);
		}
	}

	async function handleAdd(result: UserSearchResult) {
		setBusyUserId(result.user_id);
		try {
			await sendRequest(result.user_id);
			toast.success(`Friend request sent to ${result.user_name}`);
		} catch (e) {
			log.error("Send friend request failed:", e);
			toast.error("Couldn't send the request. Try again.");
		} finally {
			setBusyUserId(null);
		}
	}

	function goToFriendDiary(friend: Friend) {
		// Built out in a later step: a read-only view of this friend's daily diary.
		router.push({ pathname: "/(protected)/friends/[friend_user_id]", params: { friend_user_id: String(friend.user_id) } } as unknown as Href);
	}

	const styles = useMemo(
		() =>
			StyleSheet.create({
				scroll: { flex: 1 },
				content: { padding: 16, paddingBottom: 32, gap: 10 },
				pageTitle: { fontSize: 22, fontWeight: "800", color: theme.text, marginBottom: 12 },
				searchBar: {
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
					backgroundColor: theme.inputBg,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.inputBorder,
					borderRadius: 12,
					paddingHorizontal: 14,
					paddingVertical: 10,
					marginBottom: 16,
				},
				searchInput: { flex: 1, color: theme.text, fontSize: 15 },
				sectionLabel: {
					fontSize: 11,
					fontWeight: "700",
					color: theme.textMuted,
					letterSpacing: 1.5,
					textTransform: "uppercase",
					marginBottom: 8,
					marginTop: 4,
				},
				pendingBlock: { gap: 10, marginBottom: 20 },
				emptyInline: { color: theme.textTertiary, fontSize: 13, paddingVertical: 8 },
				emptyState: { alignItems: "center", paddingVertical: 40, gap: 8 },
				emptyTitle: { fontSize: 16, fontWeight: "700", color: theme.textMuted },
				emptySubtitle: { fontSize: 13, color: theme.textTertiary, textAlign: "center" },
				searchLoading: { paddingVertical: 24, alignItems: "center" },
			}),
		[theme],
	);

	const header = (
		<>
			<Text style={styles.pageTitle}>Friends</Text>
			<View style={styles.searchBar}>
				<FontAwesome5 name="search" size={14} color={theme.inputPlaceholder} />
				<TextInput
					style={styles.searchInput}
					placeholder="Search friends by name or handle..."
					placeholderTextColor={theme.inputPlaceholder}
					value={query}
					onChangeText={setQuery}
					autoCapitalize="none"
					autoCorrect={false}
				/>
			</View>

			{!isSearching && (
				<View style={styles.pendingBlock}>
					<Text style={styles.sectionLabel}>Pending Approvals</Text>
					<SegmentedControl
						options={["incoming", "outgoing"] as const}
						value={pendingTab}
						onChange={setPendingTab}
						labels={{ incoming: `Incoming (${incomingRequests.length})`, outgoing: `Outgoing (${outgoingRequests.length})` }}
					/>
					{(pendingTab === "incoming" ? incomingRequests : outgoingRequests).length === 0 ? (
						<Text style={styles.emptyInline}>{pendingTab === "incoming" ? "No incoming requests" : "No outgoing requests"}</Text>
					) : (
						(pendingTab === "incoming" ? incomingRequests : outgoingRequests).map((r) => (
							<FriendRequestRow
								key={r.friendship_id}
								request={r}
								direction={pendingTab}
								onAccept={pendingTab === "incoming" ? () => handleAccept(r.friendship_id) : undefined}
								onDecline={() => handleDecline(r.friendship_id, pendingTab)}
								busy={busyFriendshipId === r.friendship_id}
							/>
						))
					)}
				</View>
			)}

			{!isSearching && <Text style={styles.sectionLabel}>My Friends ({friends.length})</Text>}
		</>
	);

	if (isSearching) {
		return (
			<Screen edges={["top"]}>
				<FlatList
					data={searchResults}
					keyExtractor={(u) => String(u.user_id)}
					renderItem={({ item }) => <SearchResultRow result={item} onAdd={() => handleAdd(item)} busy={busyUserId === item.user_id} />}
					ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
					ListHeaderComponent={
						<>
							<Text style={styles.pageTitle}>Friends</Text>
							<View style={styles.searchBar}>
								<FontAwesome5 name="search" size={14} color={theme.inputPlaceholder} />
								<TextInput
									style={styles.searchInput}
									placeholder="Search friends by name or handle..."
									placeholderTextColor={theme.inputPlaceholder}
									value={query}
									onChangeText={setQuery}
									autoCapitalize="none"
									autoCorrect={false}
								/>
							</View>
						</>
					}
					ListEmptyComponent={
						searching ? (
							<View style={styles.searchLoading}>
								<ActivityIndicator color={theme.primary} />
							</View>
						) : (
							<View style={styles.emptyState}>
								<FontAwesome5 name="user-slash" size={28} color={theme.textTertiary} />
								<Text style={styles.emptyTitle}>No users found</Text>
								<Text style={styles.emptySubtitle}>Try a different name or handle</Text>
							</View>
						)
					}
					style={styles.scroll}
					contentContainerStyle={styles.content}
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
				/>
			</Screen>
		);
	}

	return (
		<Screen edges={["top"]}>
			<ScreenState loading={loading} onRetry={refresh}>
				<FlatList
					data={friends}
					keyExtractor={(f) => String(f.friendship_id)}
					renderItem={({ item }) => (
						<FriendListRow friend={item} onPress={() => goToFriendDiary(item)} onRemove={() => confirmRemove(item)} busy={busyFriendshipId === item.friendship_id} />
					)}
					ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
					ListHeaderComponent={header}
					ListEmptyComponent={
						<View style={styles.emptyState}>
							<FontAwesome5 name="user-friends" size={32} color={theme.textTertiary} />
							<Text style={styles.emptyTitle}>No friends yet</Text>
							<Text style={styles.emptySubtitle}>Search above to send your first friend request</Text>
						</View>
					}
					style={styles.scroll}
					contentContainerStyle={styles.content}
					showsVerticalScrollIndicator={false}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={async () => {
								setRefreshing(true);
								await refresh();
								setRefreshing(false);
							}}
							tintColor={theme.primary}
						/>
					}
				/>
			</ScreenState>
		</Screen>
	);
}
