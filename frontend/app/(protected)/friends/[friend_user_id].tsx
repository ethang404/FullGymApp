import { View, Text, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { useMemo, useState, useCallback } from "react";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import { toast } from "@/utils/toast";
import { todayISO } from "@/utils/date";
import { useFriends } from "@/utils/FriendsProvider";
import { ScreenState } from "@/components/ScreenState";
import Screen from "@/components/Screen";
import DiarySections, { type DiaryEntry } from "../nutrition/components/DiarySections";
import { displayName } from "../types/friends";

export default function FriendDiary() {
	const { friend_user_id } = useLocalSearchParams<{ friend_user_id: string }>();
	const { theme } = useTheme();
	const { friends } = useFriends();

	const [entries, setEntries] = useState<DiaryEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState(false);
	const [selectedDate, setSelectedDate] = useState<string>(todayISO);

	// The Friends tab already has this loaded, so this is usually a free lookup - falls
	// back to a generic title if navigated here directly without that context.
	const friend = friends.find((f) => String(f.user_id) === friend_user_id);
	const title = friend ? displayName(friend) : "Friend's Diary";

	async function fetchEntries(isRefresh = false) {
		try {
			const res = await instance.get(`/nutrition/diary/friend/${friend_user_id}`, { params: { date: selectedDate } });
			setEntries(res.data.diary_entries ?? []);
			setError(false);
		} catch (e) {
			log.error("Friend diary fetch error:", e);
			if (isRefresh) toast.error("Couldn't refresh. Pull down to try again.");
			else setError(true);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}

	useFocusEffect(
		useCallback(() => {
			fetchEntries();
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [friend_user_id, selectedDate]),
	);

	const styles = useMemo(
		() =>
			StyleSheet.create({
				headerRow: {
					flexDirection: "row",
					alignItems: "center",
					gap: 12,
					paddingHorizontal: 16,
					paddingTop: 10,
					paddingBottom: 6,
				},
				iconButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
				headerTitle: { color: theme.text, fontSize: 18, fontWeight: "700" },
				headerSubtitle: { color: theme.textMuted, fontSize: 12 },
			}),
		[theme],
	);

	return (
		<Screen edges={["top"]}>
			<View style={styles.headerRow}>
				<TouchableOpacity style={styles.iconButton} onPress={() => router.back()} hitSlop={10}>
					<FontAwesome5 name="chevron-left" size={18} color={theme.text} />
				</TouchableOpacity>
				<View style={{ flex: 1 }}>
					<Text style={styles.headerTitle} numberOfLines={1}>
						{title}
					</Text>
					<Text style={styles.headerSubtitle}>Diary — friends-visible entries only</Text>
				</View>
			</View>

			<ScreenState loading={loading} error={error} onRetry={fetchEntries} errorTitle="Couldn't load this diary">
				<DiarySections
					entries={entries}
					selectedDate={selectedDate}
					onDateChange={setSelectedDate}
					readOnly
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={() => {
								setRefreshing(true);
								fetchEntries(true);
							}}
							tintColor={theme.primary}
						/>
					}
				/>
			</ScreenState>
		</Screen>
	);
}
