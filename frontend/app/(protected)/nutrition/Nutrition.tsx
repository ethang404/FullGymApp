import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ActivityIndicator,
	SectionList,
	Modal,
	TextInput,
	ScrollView,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	Alert,
	RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useMemo, useState, useRef, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Float, Int32 } from "react-native/Libraries/Types/CodegenTypes";

import LogFoodModal from "./LogFoodModal";

//Put the various types I need here
const goals = { calories: 2500, protein: 180, carbs: 250, fat: 75 };

// Hardcoded macro colors
const MACRO_COLORS = {
	protein: "#4ADE80",
	carbs: "#3B82F6",
	fat: "#F97316",
};

type MealType = "breakfast" | "lunch" | "dinner" | "snacks";
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snacks"];

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

function formatDisplayDate(dateStr: string) {
	const [year, month, day] = dateStr.split("-").map(Number);
	const date = new Date(year, month - 1, day);

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);

	if (diffDays === 0) return "Today";
	if (diffDays === -1) return "Yesterday";
	if (diffDays === 1) return "Tomorrow";

	return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase();
}

function MacroBar({ label, current, goal, color, textColor }: { label: string; current: number; goal: number; color: string; textColor: string }) {
	const pct = Math.min((current / goal) * 100, 100);
	return (
		<View style={{ flex: 1, gap: 4 }}>
			<View style={{ flexDirection: "row", justifyContent: "space-between" }}>
				<Text style={{ fontSize: 10, fontWeight: "700", color, letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</Text>
				<Text style={{ fontSize: 10, color: textColor }}>
					{Math.round(current)}/{goal}g
				</Text>
			</View>
			<View style={{ height: 3, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
				<View style={{ height: 3, width: `${pct}%`, backgroundColor: color, borderRadius: 2 }} />
			</View>
		</View>
	);
}

export default function Nutrition() {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();

	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [logModalVisible, setLogModalVisible] = useState(false);
	const [activeMealType, setActiveMealType] = useState<MealType>("breakfast");
	const [entries, setEntries] = useState<DiaryEntry[]>([]);

	//for displaying dropdown for creating new recipes/foods
	const [createMenuOpen, setCreateMenuOpen] = useState(false);
	const [headerHeight, setHeaderHeight] = useState(52);

	//default date to today
	const [selectedDate, setSelectedDate] = useState<string>(() => {
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, "0");
		const day = String(today.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	});

	function shiftDate(dateStr: string, amount: Int32) {
		const [year, month, day] = dateStr.split("-").map(Number);
		const date = new Date(year, month - 1, day);
		date.setDate(date.getDate() + amount);

		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, "0");
		const d = String(date.getDate()).padStart(2, "0");
		return `${y}-${m}-${d}`;
	}

	async function fetchEntries() {
		try {
			const res = await instance.get(`/nutrition/diary?start_date=${selectedDate}&end_date=${selectedDate}`);
			setEntries(res.data.diary_entries ?? []);
		} catch (e) {
			console.error("Nutrition fetch error:", e);
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
		}, [selectedDate]),
	);

	const totals = useMemo(() => calculateTotalMacros(entries), [entries]);
	const remaining = goals.calories - totals.calories;

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
				safe: { flex: 1, backgroundColor: theme.background },
				header: {
					flexDirection: "row",
					justifyContent: "flex-end",
					alignItems: "center",
					paddingHorizontal: 16,
					paddingTop: 10,
					paddingBottom: 10,
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
					gap: 14,
					alignItems: "center",
				},
				remainingLabel: {
					fontSize: 11,
					fontWeight: "700",
					color: theme.textMuted,
					letterSpacing: 1.2,
					textTransform: "uppercase",
					textAlign: "center",
				},
				remainingRow: {
					flexDirection: "row",
					alignItems: "baseline",
					justifyContent: "center",
					gap: 6,
				},
				remainingValue: {
					fontSize: 46,
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
					paddingVertical: 16,
					borderLeftWidth: 3,
					marginTop: 12,
					borderLeftColor: theme.primary,
				},
				sectionHeaderText: {
					color: theme.primary,
					fontWeight: "700",
					fontSize: 13,
					letterSpacing: 0.8,
				},
				sectionHeaderCalories: {
					color: theme.textMuted,
					fontSize: 13,
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
					fontSize: 12,
					fontWeight: "600",
				},
				entryCalories: {
					color: theme.text,
					fontSize: 16,
					fontWeight: "700",
					marginLeft: 12,
				},

				logFoodRow: {
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					backgroundColor: theme.cardBg,
					paddingHorizontal: 16,
					paddingVertical: 18,
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: theme.border,
				},
				logFoodText: {
					color: theme.textMuted,
					fontWeight: "700",
					fontSize: 12,
					letterSpacing: 0.8,
				},
			}),
		[theme],
	);

	//Starting here we'll define other functions

	function renderMealHeader(title: string, calories: number) {
		return (
			<View style={styles.sectionHeader}>
				<Text style={styles.sectionHeaderText}>{title.toUpperCase()}</Text>
				<Text style={styles.sectionHeaderCalories}>{Math.round(calories)} kcal</Text>
			</View>
		);
	}

	function renderDiaryEntry(entry: DiaryEntry) {
		const name = entry.type === "food" ? entry.food?.name : entry.recipe?.name;
		const protein = entry.nutrients.protein ?? 0;
		const carbs = entry.nutrients.carbs ?? 0;
		const fat = entry.nutrients.fat ?? 0;
		const calories = entry.nutrients.calories ?? 0;

		return (
			<View style={styles.entryRow}>
				<View style={{ flex: 1 }}>
					<Text style={styles.entryName}>{name}</Text>
					<View style={styles.entryMetaRow}>
						<Text style={styles.entryMeta}>
							{entry.quantity}
							{entry.unit}
						</Text>
						<Text style={styles.entryMetaDivider}>|</Text>
						<Text style={[styles.entryMacro, { color: MACRO_COLORS.protein }]}>{Math.round(protein)}g P</Text>
						<Text style={[styles.entryMacro, { color: MACRO_COLORS.carbs }]}>{Math.round(carbs)}g C</Text>
						<Text style={[styles.entryMacro, { color: MACRO_COLORS.fat }]}>{Math.round(fat)}g F</Text>
					</View>
				</View>
				<Text style={styles.entryCalories}>{Math.round(calories)}</Text>
			</View>
		);
	}

	function renderLogFoodRow(mealType: MealType) {
		return (
			<TouchableOpacity
				style={styles.logFoodRow}
				onPress={() => {
					setActiveMealType(mealType);
					setLogModalVisible(true);
				}}
			>
				<Text style={styles.logFoodText}>LOG FOOD</Text>
				<FontAwesome5 name="plus" size={12} color={theme.primary} />
			</TouchableOpacity>
		);
	}

	if (loading) {
		return (
			<SafeAreaView style={[styles.safe, { justifyContent: "center", alignItems: "center" }]}>
				<ActivityIndicator color={theme.primary} size="large" />
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<TouchableOpacity onPress={() => setCreateMenuOpen((v) => !v)} style={styles.header} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
				<FontAwesome5 name={createMenuOpen ? "times" : "plus"} size={20} color={theme.primary} />
			</TouchableOpacity>

			{createMenuOpen && (
				<>
					<Pressable style={StyleSheet.absoluteFillObject} onPress={() => setCreateMenuOpen(false)} />
					{/* This is outside click handle ^^ */}

					<View style={[styles.createMenu, { top: headerHeight }]}>
						<TouchableOpacity style={styles.createMenuItem} onPress={() => setCreateMenuOpen(false)}>
							<Text style={styles.createMenuText}>Create food</Text>
						</TouchableOpacity>
						<View style={styles.createMenuDivider} />
						<TouchableOpacity style={styles.createMenuItem} onPress={() => setCreateMenuOpen(false)}>
							<Text style={styles.createMenuText}>Create recipe</Text>
						</TouchableOpacity>
					</View>
				</>
			)}

			<View style={styles.heroCardWrapper}>
				<View style={styles.heroCard}>
					<View style={styles.dateNavBar}>
						<TouchableOpacity onPress={() => setSelectedDate((prev) => shiftDate(prev, -1))} hitSlop={10} style={styles.dateNavArrow}>
							<FontAwesome5 name="chevron-left" size={14} color={theme.textMuted} />
						</TouchableOpacity>
						<Text style={styles.dateText}>{formatDisplayDate(selectedDate)}</Text>
						<TouchableOpacity onPress={() => setSelectedDate((prev) => shiftDate(prev, 1))} hitSlop={10} style={styles.dateNavArrow}>
							<FontAwesome5 name="chevron-right" size={14} color={theme.textMuted} />
						</TouchableOpacity>
					</View>

					<View style={styles.summaryCard}>
						<Text style={styles.remainingLabel}>Remaining Budget</Text>
						<View style={styles.remainingRow}>
							<Text style={[styles.remainingValue, remaining < 0 && { color: theme.error }]}>{Math.round(remaining).toLocaleString()}</Text>
							<Text style={styles.remainingUnit}>kcal</Text>
						</View>

						<View style={styles.macroRow}>
							<MacroBar label="Protein" current={totals.protein} goal={goals.protein} color={MACRO_COLORS.protein} textColor={theme.textMuted} />
							<MacroBar label="Carbs" current={totals.carbs} goal={goals.carbs} color={MACRO_COLORS.carbs} textColor={theme.textMuted} />
							<MacroBar label="Fat" current={totals.fat} goal={goals.fat} color={MACRO_COLORS.fat} textColor={theme.textMuted} />
						</View>
					</View>
				</View>
			</View>

			<SectionList
				style={{ flex: 1 }}
				sections={sections}
				keyExtractor={(item) => String(item.id)}
				renderItem={({ item }) => renderDiaryEntry(item)}
				renderSectionHeader={({ section }) => renderMealHeader(section.title, section.calories)}
				renderSectionFooter={({ section }) => renderLogFoodRow(section.mealType)}
				stickySectionHeadersEnabled={false}
				contentContainerStyle={{ paddingBottom: 100 + insets.bottom, backgroundColor: theme.background }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => {
							setRefreshing(true);
							fetchEntries();
						}}
						tintColor={theme.primary}
					/>
				}
			/>

			{/* Log food modal */}
			<LogFoodModal visible={logModalVisible} mealType={activeMealType} onClose={() => setLogModalVisible(false)} onLogged={fetchEntries} />
		</SafeAreaView>
	);
}
