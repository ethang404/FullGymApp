import { View, Text, StyleSheet, TouchableOpacity, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import { toast } from "@/utils/toast";
import { todayISO } from "@/utils/date";
import { useProfile } from "@/utils/ProfileProvider";
import { ScreenState } from "@/components/ScreenState";
import Screen from "@/components/Screen";

import LogFoodModal from "./LogFoodModal";
import DiarySections, { type MealType, type DiaryEntry } from "./components/DiarySections";

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

	//for displaying dropdown for creating new recipes/foods
	const [createMenuOpen, setCreateMenuOpen] = useState(false);
	const [headerHeight] = useState(52);

	//default date to today
	const [selectedDate, setSelectedDate] = useState<string>(todayISO);

	async function fetchEntries(isRefresh = false) {
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
	}

	// Refetch every time this tab regains focus (not just on first mount),
	// so coming back from another tab shows fresh data instead of a stale cache.
	useFocusEffect(
		useCallback(() => {
			fetchEntries();
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [selectedDate]),
	);

	const styles = StyleSheet.create({
		createMenu: {
			position: "absolute",
			right: 16,
			backgroundColor: theme.cardBgAlt,
			borderRadius: 12,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: theme.border,
			paddingVertical: 4,
			minWidth: 160,
			shadowColor: theme.shadowColor,
			shadowOpacity: 0.25,
			shadowRadius: 8,
			shadowOffset: { width: 0, height: 4 },
			elevation: 8,
			zIndex: 20,
		},
		createMenuItem: { paddingHorizontal: 16, paddingVertical: 12 },
		createMenuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border },
		createMenuText: { color: theme.text, fontSize: 14, fontWeight: "600" },
	});

	return (
		<Screen edges={["top"]}>
			{createMenuOpen && (
				<>
					<Pressable style={StyleSheet.absoluteFill} onPress={() => setCreateMenuOpen(false)} />
					{/* This is outside click handle ^^ */}

					<View style={[styles.createMenu, { top: headerHeight }]}>
						<TouchableOpacity
							style={styles.createMenuItem}
							onPress={() => {
								setCreateMenuOpen(false);
								router.push("/nutrition/CreateFood");
							}}
						>
							<Text style={styles.createMenuText}>Create food</Text>
						</TouchableOpacity>
						<View style={styles.createMenuDivider} />
						<TouchableOpacity
							style={styles.createMenuItem}
							onPress={() => {
								setCreateMenuOpen(false);
								router.push("/nutrition/CreateRecipe");
							}}
						>
							<Text style={styles.createMenuText}>Create recipe</Text>
						</TouchableOpacity>

						{/* New view recipes button */}
						<TouchableOpacity
							style={styles.createMenuItem}
							onPress={() => {
								setCreateMenuOpen(false);
								router.push("/nutrition/DisplayRecipes");
							}}
						>
							<Text style={styles.createMenuText}>View recipes</Text>
						</TouchableOpacity>
					</View>
				</>
			)}

			<ScreenState loading={loading} error={error} onRetry={fetchEntries} errorTitle="Couldn't load your diary">
				<DiarySections
					entries={entries}
					selectedDate={selectedDate}
					onDateChange={setSelectedDate}
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
