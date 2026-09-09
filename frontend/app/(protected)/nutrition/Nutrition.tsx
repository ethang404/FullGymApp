import { View, Text, StyleSheet, TouchableOpacity, SectionList, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMemo, useState, useCallback, type ComponentProps } from "react";
import { router, useFocusEffect } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import { toast } from "@/utils/toast";
import { todayISO, shiftISODate, formatDayHeading } from "@/utils/date";
import { useProfile } from "@/utils/ProfileProvider";
import { ScreenState } from "@/components/ScreenState";
import { RingProgress } from "@/components/RingProgress";
import Screen from "@/components/Screen";

import LogFoodModal from "./LogFoodModal";

type IconName = ComponentProps<typeof FontAwesome5>["name"];

//Put the various types I need here
// Canonical values match the backend meal_type enum. Display labels are separate
// (we still want to show "Snacks" even though the stored value is "snack").
type MealType = "breakfast" | "lunch" | "dinner" | "snack";
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const MEAL_LABELS: Record<MealType, string> = {
	breakfast: "Breakfast",
	lunch: "Lunch",
	dinner: "Dinner",
	snack: "Snacks",
};

const MEAL_ICONS: Record<MealType, IconName> = {
	breakfast: "coffee",
	lunch: "utensils",
	dinner: "moon",
	snack: "apple-alt",
};

interface DiaryEntry {
	id: number;
	type: "food" | "recipe";
	meal_type: string;
	quantity: number;
	unit: string;
	nutrients: Record<string, number>;
	food?: { id: string; name: string; brand?: string };
	recipe?: { id: string; name: string };
}

type MealSection = {
	title: string;
	mealType: MealType;
	calories: number;
	data: DiaryEntry[];
};

//math functions

//calculate total macros
type CoreMacros = { calories: number; protein: number; carbs: number; fat: number };
type Totals = CoreMacros & Record<string, number>;

function calculateTotalMacros(entries: DiaryEntry[]): Totals {
	const totals: Totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

	for (const entry of entries) {
		for (const [key, value] of Object.entries(entry.nutrients)) {
			totals[key] = (totals[key] ?? 0) + (value ?? 0);
		}
	}

	return totals;
}

function calculateMacrosPerMeal(entries: DiaryEntry[], meal_type: string): Totals {
	const totals: Totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

	for (const entry of entries) {
		if (entry.meal_type != meal_type) continue;

		for (const [key, value] of Object.entries(entry.nutrients)) {
			totals[key] = (totals[key] ?? 0) + (value ?? 0);
		}
	}

	return totals;
}

function MacroBar({
	label,
	current,
	goal,
	color,
	textColor,
	trackColor,
	valueColor,
}: {
	label: string;
	current: number;
	goal: number;
	color: string;
	textColor: string;
	trackColor: string;
	valueColor: string;
}) {
	const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
	return (
		<View style={{ flex: 1, gap: 6 }}>
			<Text style={{ fontSize: 10, fontWeight: "700", color, letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</Text>
			<Text style={{ fontSize: 17, fontWeight: "800", color: valueColor }}>
				{Math.round(current)}
				<Text style={{ fontSize: 12, fontWeight: "600", color: textColor }}> g</Text>
			</Text>
			<View style={{ height: 4, backgroundColor: trackColor, borderRadius: 2, overflow: "hidden" }}>
				<View style={{ height: 4, width: `${pct}%`, backgroundColor: color, borderRadius: 2 }} />
			</View>
		</View>
	);
}

// % of goal, guarding against a 0 / missing goal.
const pctOfGoal = (current: number, goal: number) => (goal > 0 ? (current / goal) * 100 : 0);

export default function Nutrition() {
	const { theme } = useTheme();
	const { goals, profile } = useProfile();
	const insets = useSafeAreaInsets();

	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState(false);
	const [logModalVisible, setLogModalVisible] = useState(false);
	const [activeMealType, setActiveMealType] = useState<MealType>("breakfast");
	const [entries, setEntries] = useState<DiaryEntry[]>([]);

	//for displaying dropdown for creating new recipes/foods
	const [createMenuOpen, setCreateMenuOpen] = useState(false);
	const [headerHeight, setHeaderHeight] = useState(52);

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

	const totals = useMemo(() => calculateTotalMacros(entries), [entries]);

	const sections: MealSection[] = useMemo(() => {
		return MEAL_TYPES.map((mealType) => ({
			title: mealType,
			mealType,
			calories: calculateMacrosPerMeal(entries, mealType).calories,
			data: entries.filter((e) => e.meal_type === mealType),
		}));
	}, [entries]);

	const styles = useMemo(
		() =>
			StyleSheet.create({
				header: {
					paddingHorizontal: 16,
					paddingTop: 10,
					paddingBottom: 14,
				},
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

				heroCardWrapper: {
					marginHorizontal: 16,
					marginTop: 12,
					marginBottom: 4,
					borderRadius: 20,
					backgroundColor: theme.cardBg,
					shadowColor: theme.shadowColor,
					shadowOpacity: 0.25,
					shadowRadius: 10,
					shadowOffset: { width: 0, height: 4 },
					elevation: 8,
				},
				heroCard: {
					borderRadius: 20,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.border,
					overflow: "hidden",
				},
				dateNavBar: {
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					paddingVertical: 14,
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: theme.border,
				},
				dateNavArrow: {
					paddingHorizontal: 20,
					paddingVertical: 4,
				},
				dateText: {
					color: theme.textSecondary,
					fontWeight: "700",
					fontSize: 13,
					letterSpacing: 1.2,
				},
				summaryCard: {
					paddingHorizontal: 20,
					paddingVertical: 24,
					gap: 18,
				},
				remainingLabel: {
					fontSize: 11,
					fontWeight: "700",
					color: theme.textMuted,
					letterSpacing: 1.2,
					textTransform: "uppercase",
				},
				remainingRow: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
				},
				remainingValue: {
					fontSize: 40,
					fontWeight: "800",
					color: theme.text,
					letterSpacing: -1,
				},
				remainingUnit: {
					fontSize: 14,
					color: theme.textMuted,
				},
				macroRow: {
					flexDirection: "row",
					gap: 20,
					width: "100%",
				},

				// Section headers (BREAKFAST / LUNCH / DINNER / SNACKS)
				sectionHeader: {
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					backgroundColor: theme.cardBgAlt,
					paddingHorizontal: 16,
					paddingVertical: 14,
					marginTop: 12,
					borderTopLeftRadius: 16,
					borderTopRightRadius: 16,
				},
				sectionHeaderLast: {
					borderBottomLeftRadius: 16,
					borderBottomRightRadius: 16,
				},
				sectionHeaderLeft: {
					flexDirection: "row",
					alignItems: "center",
					gap: 12,
				},
				sectionIconChip: {
					width: 34,
					height: 34,
					borderRadius: 10,
					backgroundColor: theme.background,
					alignItems: "center",
					justifyContent: "center",
				},
				sectionHeaderText: {
					color: theme.text,
					fontWeight: "700",
					fontSize: 15,
				},
				sectionHeaderCalories: {
					color: theme.textMuted,
					fontSize: 12,
					marginTop: 1,
				},
				sectionAddButton: {
					width: 30,
					height: 30,
					borderRadius: 15,
					alignItems: "center",
					justifyContent: "center",
					borderWidth: 1.5,
					borderColor: theme.primary,
				},
				sectionAddButtonFilled: {
					backgroundColor: theme.primary,
					borderColor: theme.primary,
				},

				// Diary entry rows
				entryRow: {
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					backgroundColor: theme.cardBg,
					paddingHorizontal: 16,
					paddingVertical: 12,
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: theme.border,
				},
				entryRowLast: {
					borderBottomWidth: 0,
					borderBottomLeftRadius: 16,
					borderBottomRightRadius: 16,
					marginBottom: 4,
				},
				entryName: {
					color: theme.text,
					fontSize: 15,
					fontWeight: "600",
				},
				entryMetaRow: {
					flexDirection: "row",
					alignItems: "center",
					gap: 6,
					marginTop: 2,
				},
				entryMeta: {
					color: theme.textMuted,
					fontSize: 12,
				},
				entryMetaDivider: {
					color: theme.textTertiary,
					fontSize: 12,
				},
				entryMacro: {
					fontSize: 11,
					fontWeight: "500",
				},
				entryCalories: {
					color: theme.text,
					fontSize: 16,
					fontWeight: "700",
					marginLeft: 12,
				},
			}),
		[theme],
	);

	//Starting here we'll define other functions

	function renderMealHeader(mealType: MealType, calories: number, isLastSection: boolean) {
		const hasEntries = calories > 0;
		return (
			<View style={[styles.sectionHeader, isLastSection && styles.sectionHeaderLast]}>
				<View style={styles.sectionHeaderLeft}>
					<View style={styles.sectionIconChip}>
						<FontAwesome5 name={MEAL_ICONS[mealType]} size={14} color={theme.primary} />
					</View>
					<View>
						<Text style={styles.sectionHeaderText}>{MEAL_LABELS[mealType]}</Text>
						<Text style={styles.sectionHeaderCalories}>{Math.round(calories)} kcal</Text>
					</View>
				</View>
				<TouchableOpacity
					style={[styles.sectionAddButton, !hasEntries && styles.sectionAddButtonFilled]}
					hitSlop={8}
					onPress={() => {
						setActiveMealType(mealType);
						setLogModalVisible(true);
					}}
				>
					<FontAwesome5 name="plus" size={12} color={hasEntries ? theme.primary : theme.textInverse} />
				</TouchableOpacity>
			</View>
		);
	}

	function renderDiaryEntry(entry: DiaryEntry, isLastInSection: boolean) {
		const name = entry.type === "food" ? entry.food?.name : entry.recipe?.name;
		const protein = entry.nutrients.protein ?? 0;
		const carbs = entry.nutrients.carbs ?? 0;
		const fat = entry.nutrients.fat ?? 0;
		const calories = entry.nutrients.calories ?? 0;

		return (
			<View style={[styles.entryRow, isLastInSection && styles.entryRowLast]}>
				<View style={{ flex: 1 }}>
					<Text style={styles.entryName}>{name}</Text>
					<View style={styles.entryMetaRow}>
						<Text style={styles.entryMeta}>
							{entry.quantity}
							{entry.unit}
						</Text>
						<Text style={styles.entryMetaDivider}>|</Text>
						<Text style={[styles.entryMacro, { color: theme.macroProtein }]}>{Math.round(protein)}g P</Text>
						<Text style={[styles.entryMacro, { color: theme.macroCarbs }]}>{Math.round(carbs)}g C</Text>
						<Text style={[styles.entryMacro, { color: theme.macroFat }]}>{Math.round(fat)}g F</Text>
					</View>
				</View>
				<Text style={styles.entryCalories}>{Math.round(calories)}</Text>
			</View>
		);
	}

	const initials = (profile?.first_name?.[0] || profile?.user_name?.[0] || "U").toUpperCase();

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
				<View style={styles.heroCardWrapper}>
					<View style={styles.heroCard}>
						<View style={styles.dateNavBar}>
							<TouchableOpacity onPress={() => setSelectedDate((prev) => shiftISODate(prev, -1))} hitSlop={10} style={styles.dateNavArrow}>
								<FontAwesome5 name="chevron-left" size={14} color={theme.textMuted} />
							</TouchableOpacity>
							<Text style={styles.dateText}>{formatDayHeading(selectedDate)}</Text>
							<TouchableOpacity onPress={() => setSelectedDate((prev) => shiftISODate(prev, 1))} hitSlop={10} style={styles.dateNavArrow}>
								<FontAwesome5 name="chevron-right" size={14} color={theme.textMuted} />
							</TouchableOpacity>
						</View>

						<View style={styles.summaryCard}>
							<Text style={styles.remainingLabel}>Calories Consumed</Text>
							<View style={styles.remainingRow}>
								<View>
									<Text style={styles.remainingValue}>{Math.round(totals.calories).toLocaleString()}</Text>
									<Text style={styles.remainingUnit}>of {goals.calories.toLocaleString()} kcal</Text>
								</View>
								<RingProgress percent={pctOfGoal(totals.calories, goals.calories)} color={theme.primary} trackColor={theme.border} size={72} strokeWidth={7} />
							</View>

							<View style={styles.macroRow}>
								<MacroBar
									label="Protein"
									current={totals.protein}
									goal={goals.protein}
									color={theme.macroProtein}
									textColor={theme.textMuted}
									trackColor={theme.border}
									valueColor={theme.text}
								/>
								<MacroBar
									label="Carbs"
									current={totals.carbs}
									goal={goals.carbs}
									color={theme.macroCarbs}
									textColor={theme.textMuted}
									trackColor={theme.border}
									valueColor={theme.text}
								/>
								<MacroBar
									label="Fat"
									current={totals.fat}
									goal={goals.fat}
									color={theme.macroFat}
									textColor={theme.textMuted}
									trackColor={theme.border}
									valueColor={theme.text}
								/>
								<MacroBar
									label="Fiber"
									current={totals.fiber ?? 0}
									goal={goals.fiber}
									color={theme.macroCarbs}
									textColor={theme.textMuted}
									trackColor={theme.border}
									valueColor={theme.text}
								/>
							</View>
						</View>
					</View>
				</View>

				<SectionList
					style={{ flex: 1 }}
					sections={sections}
					keyExtractor={(item) => String(item.id)}
					renderItem={({ item, index, section }) => renderDiaryEntry(item, index === section.data.length - 1)}
					renderSectionHeader={({ section }) => renderMealHeader(section.mealType, section.calories, section.data.length === 0)}
					stickySectionHeadersEnabled={false}
					contentContainerStyle={{ paddingBottom: 100 + insets.bottom, backgroundColor: theme.background }}
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
