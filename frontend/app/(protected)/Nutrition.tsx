import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, SectionList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo, useEffect, useState, useCallback } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Nutrients {
	calories: number;
	protein: number;
	carbs: number;
	fat: number;
}

interface DiaryEntry {
	id: string;
	type: "food" | "recipe";
	meal_type: string;
	quantity: number;
	unit: string;
	nutrients: Nutrients | null;
	food?: { id: string; name: string; brand?: string };
	recipe?: { id: string; name: string };
}

interface MealSection {
	title: string;
	meal_type: string;
	icon: string;
	data: DiaryEntry[];
	totals: Nutrients;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snacks"];
const MEAL_ICONS: Record<string, string> = {
	breakfast: "sun",
	lunch: "cloud-sun",
	dinner: "moon",
	snacks: "apple-alt",
};

function todayISO() {
	return new Date().toISOString().split("T")[0];
}

function sumNutrients(entries: DiaryEntry[]): Nutrients {
	return entries.reduce(
		(acc, e) => ({
			calories: acc.calories + (e.nutrients?.calories ?? 0),
			protein: acc.protein + (e.nutrients?.protein ?? 0),
			carbs: acc.carbs + (e.nutrients?.carbs ?? 0),
			fat: acc.fat + (e.nutrients?.fat ?? 0),
		}),
		{ calories: 0, protein: 0, carbs: 0, fat: 0 },
	);
}

function groupByMeal(entries: DiaryEntry[]): MealSection[] {
	const map: Record<string, DiaryEntry[]> = {};
	for (const e of entries) {
		const key = e.meal_type.toLowerCase();
		if (!map[key]) map[key] = [];
		map[key].push(e);
	}
	return MEAL_ORDER.map((m) => ({
		title: m.charAt(0).toUpperCase() + m.slice(1),
		meal_type: m,
		icon: MEAL_ICONS[m] ?? "utensils",
		data: map[m] ?? [],
		totals: sumNutrients(map[m] ?? []),
	}));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MacroBar({ label, current, goal, color, textColor }: { label: string; current: number; goal: number; color: string; textColor: string }) {
	const pct = Math.min((current / goal) * 100, 100);
	return (
		<View style={{ flex: 1, gap: 4 }}>
			<View style={{ flexDirection: "row", justifyContent: "space-between" }}>
				<Text style={{ fontSize: 10, fontWeight: "700", color: textColor, letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</Text>
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function Nutrition() {
	const { theme } = useTheme();
	const [entries, setEntries] = useState<DiaryEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);

	// Goals: ideally come from user profile later
	const goals = { calories: 2500, protein: 180, carbs: 250, fat: 75 };

	async function fetchEntries() {
		try {
			const today = todayISO();
			const res = await instance.get(`/nutrition/diary?start_date=${today}&end_date=${today}`);
			console.log("What does res look like?");
			console.log(res.data.diary_entries);
			console.log("--------");
			setEntries(res.data.diary_entries ?? []);
		} catch (e) {
			console.error("Nutrition fetch error:", e);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}

	useEffect(() => {
		fetchEntries();
	}, []);

	const sections = useMemo(() => groupByMeal(entries), [entries]);
	const dayTotals = useMemo(() => sumNutrients(entries), [entries]);
	const remaining = goals.calories - dayTotals.calories;

	const styles = useMemo(
		() =>
			StyleSheet.create({
				safe: { flex: 1, backgroundColor: theme.background },

				// Summary hero card
				heroCard: {
					backgroundColor: theme.cardBg,
					marginHorizontal: 16,
					marginTop: 12,
					marginBottom: 16,
					borderRadius: 16,
					padding: 18,
					borderWidth: 1,
					borderColor: theme.border,
				},
				heroTop: {
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "flex-start",
					marginBottom: 14,
				},
				remainLabel: {
					fontSize: 11,
					fontWeight: "700",
					color: theme.textMuted,
					letterSpacing: 1.5,
					textTransform: "uppercase",
				},
				remainNumber: {
					fontSize: 44,
					fontWeight: "800",
					color: remaining >= 0 ? theme.text : theme.error,
					lineHeight: 48,
				},
				goalText: {
					fontSize: 13,
					color: theme.textMuted,
					marginTop: 2,
				},
				goalEaten: {
					fontSize: 13,
					color: theme.textMuted,
				},
				macroRow: {
					flexDirection: "row",
					gap: 12,
				},

				// Page header
				pageHeader: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					paddingHorizontal: 16,
					paddingTop: 16,
					paddingBottom: 4,
				},
				pageTitle: {
					fontSize: 22,
					fontWeight: "800",
					color: theme.text,
				},
				addBtn: {
					flexDirection: "row",
					alignItems: "center",
					gap: 6,
					backgroundColor: theme.primary,
					paddingHorizontal: 14,
					paddingVertical: 8,
					borderRadius: 10,
				},
				addBtnText: {
					fontSize: 12,
					fontWeight: "700",
					color: theme.textInverse,
					textTransform: "uppercase",
					letterSpacing: 0.5,
				},

				// Section header
				sectionHeader: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					backgroundColor: theme.background,
					paddingHorizontal: 16,
					paddingTop: 16,
					paddingBottom: 8,
				},
				sectionLeft: {
					flexDirection: "row",
					alignItems: "center",
					gap: 10,
				},
				sectionIconWrap: {
					width: 34,
					height: 34,
					borderRadius: 10,
					backgroundColor: theme.cardBgAlt,
					alignItems: "center",
					justifyContent: "center",
					borderWidth: 1,
					borderColor: theme.border,
				},
				sectionTitle: {
					fontSize: 15,
					fontWeight: "700",
					color: theme.text,
				},
				sectionMeta: {
					fontSize: 12,
					color: theme.textMuted,
					marginTop: 1,
				},
				sectionAddBtn: {
					width: 28,
					height: 28,
					borderRadius: 8,
					borderWidth: 1,
					borderColor: theme.primary,
					alignItems: "center",
					justifyContent: "center",
				},

				// Entry row
				entryCard: {
					flexDirection: "row",
					alignItems: "center",
					marginHorizontal: 16,
					marginBottom: 2,
					backgroundColor: theme.cardBg,
					borderRadius: 12,
					paddingHorizontal: 14,
					paddingVertical: 12,
					borderWidth: 1,
					borderColor: theme.border,
				},
				entryName: {
					fontSize: 15,
					fontWeight: "600",
					color: theme.text,
					flex: 1,
				},
				entryMeta: {
					fontSize: 12,
					color: theme.textMuted,
					marginTop: 2,
				},
				entryCalories: {
					fontSize: 15,
					fontWeight: "700",
					color: theme.text,
					marginLeft: 12,
				},

				emptyMeal: {
					marginHorizontal: 16,
					marginBottom: 2,
					paddingVertical: 14,
					paddingHorizontal: 14,
					backgroundColor: theme.cardBg,
					borderRadius: 12,
					borderWidth: 1,
					borderColor: theme.border,
					borderStyle: "dashed",
					alignItems: "center",
				},
				emptyMealText: {
					fontSize: 13,
					color: theme.textTertiary,
				},
			}),
		[theme, remaining],
	);

	if (loading) {
		return (
			<SafeAreaView style={[styles.safe, { justifyContent: "center", alignItems: "center" }]}>
				<ActivityIndicator color={theme.primary} size="large" />
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<SectionList
				sections={sections}
				keyExtractor={(item) => item.id}
				showsVerticalScrollIndicator={false}
				stickySectionHeadersEnabled={false}
				onRefresh={fetchEntries}
				refreshing={refreshing}
				ListHeaderComponent={
					<>
						{/* Page header */}
						<View style={styles.pageHeader}>
							<Text style={styles.pageTitle}>Nutrition</Text>
							<TouchableOpacity style={styles.addBtn} activeOpacity={0.8}>
								<FontAwesome5 name="search" size={11} color={theme.textInverse} />
								<Text style={styles.addBtnText}>Find Food</Text>
							</TouchableOpacity>
						</View>

						{/* Hero summary card */}
						<View style={styles.heroCard}>
							<View style={styles.heroTop}>
								<View>
									<Text style={styles.remainLabel}>Remaining</Text>
									<Text style={styles.remainNumber}>{remaining.toLocaleString()}</Text>
									<Text style={styles.goalText}>Goal: {goals.calories.toLocaleString()} kcal</Text>
								</View>
								<Text style={styles.goalEaten}>{dayTotals.calories.toLocaleString()} eaten</Text>
							</View>
							<View style={styles.macroRow}>
								<MacroBar label="Protein" current={dayTotals.protein} goal={goals.protein} color="#4ADE80" textColor={theme.textSecondary} />
								<MacroBar label="Carbs" current={dayTotals.carbs} goal={goals.carbs} color="#38BDF8" textColor={theme.textSecondary} />
								<MacroBar label="Fat" current={dayTotals.fat} goal={goals.fat} color="#FB923C" textColor={theme.textSecondary} />
							</View>
						</View>
					</>
				}
				renderSectionHeader={({ section }) => (
					<View style={styles.sectionHeader}>
						<View style={styles.sectionLeft}>
							<View style={styles.sectionIconWrap}>
								<FontAwesome5 name={section.icon} size={14} color={theme.primary} />
							</View>
							<View>
								<Text style={styles.sectionTitle}>{section.title}</Text>
								<Text style={styles.sectionMeta}>
									{section.totals.calories > 0
										? `${Math.round(section.totals.calories)} kcal · P: ${Math.round(section.totals.protein)}g · C: ${Math.round(section.totals.carbs)}g · F: ${Math.round(section.totals.fat)}g`
										: "No entries yet"}
								</Text>
							</View>
						</View>
						<TouchableOpacity style={styles.sectionAddBtn} activeOpacity={0.7}>
							<FontAwesome5 name="plus" size={12} color={theme.primary} />
						</TouchableOpacity>
					</View>
				)}
				renderItem={({ item }) => (
					<View style={styles.entryCard}>
						<View style={{ flex: 1 }}>
							<Text style={styles.entryName}>{item.food?.name ?? item.recipe?.name ?? "Unknown"}</Text>
							<Text style={styles.entryMeta}>
								{item.quantity} {item.unit}
								{item.food?.brand ? ` · ${item.food.brand}` : ""}
							</Text>
						</View>
						<Text style={styles.entryCalories}>{Math.round(item.nutrients?.calories ?? 0)}</Text>
					</View>
				)}
				renderSectionFooter={({ section }) =>
					section.data.length === 0 ? (
						<TouchableOpacity style={styles.emptyMeal} activeOpacity={0.6}>
							<Text style={styles.emptyMealText}>+ Log {section.title}</Text>
						</TouchableOpacity>
					) : null
				}
				contentContainerStyle={{ paddingBottom: 32 }}
			/>
		</SafeAreaView>
	);
}
