import { View, Text, StyleSheet, TouchableOpacity, SectionList, type RefreshControlProps } from "react-native";
import { useMemo, type ComponentProps, type ReactElement } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { shiftISODate, formatDayHeading } from "@/utils/date";
import { RingProgress } from "@/components/RingProgress";
import type { MacroGoals } from "@/utils/macroDefaults";

type IconName = ComponentProps<typeof FontAwesome5>["name"];

// Canonical values match the backend meal_type enum. Display labels are separate
// (we still want to show "Snacks" even though the stored value is "snack").
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

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

export interface DiaryEntry {
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

// % of goal, guarding against a 0 / missing goal.
const pctOfGoal = (current: number, goal: number) => (goal > 0 ? (current / goal) * 100 : 0);

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

// Goal-less counterpart to MacroBar - just the total, no progress bar, for a
// friend's diary where we don't know their goals.
function MacroStat({ label, current, color, textColor }: { label: string; current: number; color: string; textColor: string }) {
	return (
		<View style={{ flex: 1, gap: 6 }}>
			<Text style={{ fontSize: 10, fontWeight: "700", color, letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</Text>
			<Text style={{ fontSize: 17, fontWeight: "800", color: textColor }}>
				{Math.round(current)}
				<Text style={{ fontSize: 12, fontWeight: "600" }}> g</Text>
			</Text>
		</View>
	);
}

interface DiarySectionsProps {
	entries: DiaryEntry[];
	selectedDate: string;
	onDateChange: (date: string) => void;
	/** Omit for a read-only view where the viewer's own goals don't apply (e.g. a friend's diary) - renders totals without goal-relative rings/bars. */
	goals?: MacroGoals;
	/** Hides the per-meal "+" add button and disables logging entirely. */
	readOnly?: boolean;
	onAddMeal?: (mealType: MealType) => void;
	bottomInset?: number;
	refreshControl?: ReactElement<RefreshControlProps>;
}

// Shared by Nutrition.tsx (the viewer's own diary, editable) and
// friends/[friend_user_id].tsx (a friend's diary, read-only) - hero summary card +
// per-meal sections, computed from `entries` alone so both screens just fetch and hand
// off data.
export default function DiarySections({ entries, selectedDate, onDateChange, goals, readOnly, onAddMeal, bottomInset = 0, refreshControl }: DiarySectionsProps) {
	const { theme } = useTheme();

	const totals = useMemo(() => calculateTotalMacros(entries), [entries]);

	const sections: MealSection[] = useMemo(
		() =>
			MEAL_TYPES.map((mealType) => ({
				title: mealType,
				mealType,
				calories: calculateMacrosPerMeal(entries, mealType).calories,
				data: entries.filter((e) => e.meal_type === mealType),
			})),
		[entries],
	);

	const styles = useMemo(
		() =>
			StyleSheet.create({
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
				{!readOnly && (
					<TouchableOpacity style={[styles.sectionAddButton, !hasEntries && styles.sectionAddButtonFilled]} hitSlop={8} onPress={() => onAddMeal?.(mealType)}>
						<FontAwesome5 name="plus" size={12} color={hasEntries ? theme.primary : theme.textInverse} />
					</TouchableOpacity>
				)}
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

	return (
		<>
			<View style={styles.heroCardWrapper}>
				<View style={styles.heroCard}>
					<View style={styles.dateNavBar}>
						<TouchableOpacity onPress={() => onDateChange(shiftISODate(selectedDate, -1))} hitSlop={10} style={styles.dateNavArrow}>
							<FontAwesome5 name="chevron-left" size={14} color={theme.textMuted} />
						</TouchableOpacity>
						<Text style={styles.dateText}>{formatDayHeading(selectedDate)}</Text>
						<TouchableOpacity onPress={() => onDateChange(shiftISODate(selectedDate, 1))} hitSlop={10} style={styles.dateNavArrow}>
							<FontAwesome5 name="chevron-right" size={14} color={theme.textMuted} />
						</TouchableOpacity>
					</View>

					<View style={styles.summaryCard}>
						{goals ? (
							<>
								<Text style={styles.remainingLabel}>Calories Consumed</Text>
								<View style={styles.remainingRow}>
									<View>
										<Text style={styles.remainingValue}>{Math.round(totals.calories).toLocaleString()}</Text>
										<Text style={styles.remainingUnit}>of {goals.calories.toLocaleString()} kcal</Text>
									</View>
									<RingProgress percent={pctOfGoal(totals.calories, goals.calories)} color={theme.primary} trackColor={theme.border} size={72} strokeWidth={7} />
								</View>

								<View style={styles.macroRow}>
									<MacroBar label="Protein" current={totals.protein} goal={goals.protein} color={theme.macroProtein} textColor={theme.textMuted} trackColor={theme.border} valueColor={theme.text} />
									<MacroBar label="Carbs" current={totals.carbs} goal={goals.carbs} color={theme.macroCarbs} textColor={theme.textMuted} trackColor={theme.border} valueColor={theme.text} />
									<MacroBar label="Fat" current={totals.fat} goal={goals.fat} color={theme.macroFat} textColor={theme.textMuted} trackColor={theme.border} valueColor={theme.text} />
									<MacroBar label="Fiber" current={totals.fiber ?? 0} goal={goals.fiber} color={theme.macroCarbs} textColor={theme.textMuted} trackColor={theme.border} valueColor={theme.text} />
								</View>
							</>
						) : (
							<>
								<Text style={styles.remainingLabel}>Calories Logged</Text>
								<Text style={styles.remainingValue}>{Math.round(totals.calories).toLocaleString()}</Text>

								<View style={styles.macroRow}>
									<MacroStat label="Protein" current={totals.protein} color={theme.macroProtein} textColor={theme.text} />
									<MacroStat label="Carbs" current={totals.carbs} color={theme.macroCarbs} textColor={theme.text} />
									<MacroStat label="Fat" current={totals.fat} color={theme.macroFat} textColor={theme.text} />
									<MacroStat label="Fiber" current={totals.fiber ?? 0} color={theme.macroCarbs} textColor={theme.text} />
								</View>
							</>
						)}
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
				contentContainerStyle={{ paddingBottom: 100 + bottomInset, backgroundColor: theme.background }}
				refreshControl={refreshControl}
			/>
		</>
	);
}
