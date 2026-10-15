import { RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import { toast } from "@/utils/toast";
import { todayISO } from "@/utils/date";
import { useProfile } from "@/utils/ProfileProvider";
import { ScreenState } from "@/components/ScreenState";
import Screen from "@/components/Screen";

import LogFoodModal from "@/features/nutrition/components/LogFoodModal";
import DiarySections, { type MealType, type DiaryEntry } from "@/features/nutrition/components/DiarySections";
import DateNavBar from "@/features/nutrition/components/DateNavBar";

export default function Nutrition() {
	const { theme } = useTheme();
	const { goals } = useProfile();
	const insets = useSafeAreaInsets();

	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState(false);
	const [logModalVisible, setLogModalVisible] = useState(false);
	const [activeMealType, setActiveMealType] = useState<MealType>("breakfast");
	const [entries, setEntries] = useState<DiaryEntry[]>([]);

	//default date to today
	const [selectedDate, setSelectedDate] = useState<string>(todayISO);

	const fetchEntries = useCallback(
		async (isRefresh = false) => {
			try {
				const res = await instance.get(`/nutrition/diary?start_date=${selectedDate}&end_date=${selectedDate}`);
				setEntries(res.data.diary_entries ?? []);
				setError(false);
			} catch (e) {
				log.error("Nutrition fetch error:", e);
				if (isRefresh) toast.error("Couldn't refresh. Pull down to try again.");
				else setError(true);
			} finally {
				setLoading(false);
				setRefreshing(false);
			}
		},
		[selectedDate],
	);

	// Refetch every time this tab regains focus (not just on first mount),
	// so coming back from another tab shows fresh data instead of a stale cache.
	useFocusEffect(
		useCallback(() => {
			fetchEntries();
		}, [fetchEntries]),
	);

	return (
		<Screen edges={["top"]}>
			{/* Outside ScreenState so you can still switch days while a day is loading or failed */}
			<DateNavBar selectedDate={selectedDate} onChange={setSelectedDate} />

			<ScreenState loading={loading} error={error} onRetry={fetchEntries} errorTitle="Couldn't load your diary">
				<DiarySections
					entries={entries}
					goals={goals}
					onAddMeal={(mealType) => {
						setActiveMealType(mealType);
						setLogModalVisible(true);
					}}
					bottomInset={insets.bottom}
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

			{/* Log food modal */}
			<LogFoodModal
				visible={logModalVisible}
				mealType={activeMealType}
				selectedDate={selectedDate}
				onClose={() => setLogModalVisible(false)}
				onLogged={fetchEntries}
			/>
		</Screen>
	);
}
