import { useMemo } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/typography";
import { MACRO_META, type MacroKey } from "@/utils/macroDefaults";
import { Card } from "./Card";

const GRAMS: Exclude<MacroKey, "calories">[] = ["protein", "carbs", "fat", "fiber"];

// Step 2: the suggested goals, every number editable.
export function GoalsReview({ goals, onChange }: { goals: Record<string, string>; onChange: (key: MacroKey, text: string) => void }) {
	const { theme } = useTheme();

	const dotColor: Record<(typeof GRAMS)[number], string> = {
		protein: theme.macroProtein,
		carbs: theme.macroCarbs,
		fat: theme.macroFat,
		fiber: theme.primary,
	};

	const styles = useMemo(
		() =>
			StyleSheet.create({
				eyebrow: { color: theme.textMuted, fontSize: 13 },
				calorieRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
				calorieInput: { color: theme.text, fontSize: 44, fontFamily: fonts.headingHeavy, minWidth: 100, paddingVertical: 0 },
				calorieUnit: { color: theme.textMuted, fontSize: 15, fontFamily: fonts.headingMedium },
				grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
				tile: { flexBasis: "47%", flexGrow: 1, backgroundColor: theme.cardBgAlt, borderRadius: 14, padding: 12 },
				tileLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
				dot: { width: 8, height: 8, borderRadius: 4 },
				tileLabel: { color: theme.textMuted, fontSize: 13 },
				tileValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 4 },
				tileInput: { color: theme.text, fontSize: 26, fontFamily: fonts.heading, minWidth: 48, paddingVertical: 0 },
				tileUnit: { color: theme.textMuted, fontSize: 13 },
			}),
		[theme],
	);

	return (
		<Card>
			<Text style={styles.eyebrow}>Calories a day</Text>
			<View style={styles.calorieRow}>
				<TextInput
					style={styles.calorieInput}
					value={goals.calories}
					onChangeText={(t) => onChange("calories", t)}
					keyboardType="number-pad"
					accessibilityLabel="Calories goal"
				/>
				<Text style={styles.calorieUnit}>{MACRO_META.calories.unit}</Text>
			</View>

			<View style={styles.grid}>
				{GRAMS.map((k) => (
					<View key={k} style={styles.tile}>
						<View style={styles.tileLabelRow}>
							<View style={[styles.dot, { backgroundColor: dotColor[k] }]} />
							<Text style={styles.tileLabel}>{MACRO_META[k].label}</Text>
						</View>
						<View style={styles.tileValueRow}>
							<TextInput
								style={styles.tileInput}
								value={goals[k]}
								onChangeText={(t) => onChange(k, t)}
								keyboardType="number-pad"
								accessibilityLabel={`${MACRO_META[k].label} goal in grams`}
							/>
							<Text style={styles.tileUnit}>{MACRO_META[k].unit}</Text>
						</View>
					</View>
				))}
			</View>
		</Card>
	);
}
