import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/typography";
import SegmentedControl from "@/components/SegmentedControl";
import { GOAL_TYPES, GOAL_TYPE_LABELS, type GoalType } from "@/utils/macroDefaults";
import { Card, CardHeader } from "./Card";

// Weight in and out is always kilograms as a string (what the API stores). In lb mode
// the typed text is kept here so "17" doesn't jump to "16.9" while someone is typing.

const KG_PER_LB = 0.45359237;
const UNITS = ["lb", "kg"] as const;
type Unit = (typeof UNITS)[number];

const round1 = (n: number) => String(Math.round(n * 10) / 10);
const clean = (t: string) => t.replace(/[^0-9.]/g, "");

interface Props {
	weightKg: string;
	onWeightChange: (kg: string) => void;
	goalType: GoalType | null;
	onGoalTypeChange: (goal: GoalType) => void;
}

export function WeightGoalCard({ weightKg, onWeightChange, goalType, onGoalTypeChange }: Props) {
	const { theme } = useTheme();
	const [unit, setUnit] = useState<Unit>("lb");
	const kg = parseFloat(weightKg);
	const [lbText, setLbText] = useState(kg > 0 ? round1(kg / KG_PER_LB) : "");

	function switchUnit(next: Unit) {
		if (next === "lb") setLbText(kg > 0 ? round1(kg / KG_PER_LB) : "");
		setUnit(next);
	}

	function handleText(t: string) {
		const next = clean(t);
		if (unit === "kg") return onWeightChange(next);
		setLbText(next);
		const lb = parseFloat(next);
		onWeightChange(lb > 0 ? String(Math.round(lb * KG_PER_LB * 100) / 100) : "");
	}

	const conversion = !(kg > 0) ? "Type your weight" : unit === "lb" ? `${round1(kg)} kg` : `${round1(kg / KG_PER_LB)} lb`;

	const styles = useMemo(
		() =>
			StyleSheet.create({
				toggle: { width: 96 },
				weightTile: { backgroundColor: theme.cardBgAlt, borderRadius: 14, padding: 14, marginTop: 14 },
				tileLabel: { color: theme.textMuted, fontSize: 13 },
				inputRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
				input: { color: theme.text, fontSize: 36, fontFamily: fonts.heading, minWidth: 70, paddingVertical: 0 },
				inputUnit: { color: theme.textMuted, fontSize: 15, fontFamily: fonts.headingMedium },
				conversion: { color: theme.primary, fontSize: 13, fontWeight: "600" },
				goalLabel: { color: theme.text, fontSize: 14, fontWeight: "600", marginTop: 16, marginBottom: 8 },
				goalRow: { flexDirection: "row", gap: 8 },
				goal: {
					flex: 1,
					alignItems: "center",
					paddingVertical: 10,
					borderRadius: 12,
					borderWidth: 1.5,
					borderColor: theme.border,
				},
				goalSelected: { borderColor: theme.primary, backgroundColor: theme.cardBgAlt },
				goalText: { color: theme.textMuted, fontSize: 13, fontWeight: "600" },
				goalTextSelected: { color: theme.primary },
			}),
		[theme],
	);

	return (
		<Card>
			<CardHeader
				title="Weight and goal"
				subtitle="Where you are and where you're heading"
				right={
					<View style={styles.toggle}>
						<SegmentedControl options={UNITS} value={unit} onChange={switchUnit} />
					</View>
				}
			/>

			<View style={styles.weightTile}>
				<Text style={styles.tileLabel}>Current weight</Text>
				<View style={styles.inputRow}>
					<TextInput
						style={styles.input}
						value={unit === "kg" ? weightKg : lbText}
						onChangeText={handleText}
						placeholder={unit === "kg" ? "70" : "155"}
						placeholderTextColor={theme.textTertiary}
						keyboardType="decimal-pad"
						accessibilityLabel={unit === "kg" ? "Weight in kilograms" : "Weight in pounds"}
					/>
					<Text style={styles.inputUnit}>{unit}</Text>
				</View>
				<Text style={styles.conversion}>{conversion}</Text>
			</View>

			<Text style={styles.goalLabel}>What are you aiming for?</Text>
			<View style={styles.goalRow}>
				{GOAL_TYPES.map((g) => {
					const selected = goalType === g;
					return (
						<Pressable
							key={g}
							style={[styles.goal, selected && styles.goalSelected]}
							onPress={() => onGoalTypeChange(g)}
							accessibilityRole="radio"
							accessibilityState={{ selected }}
						>
							<Text style={[styles.goalText, selected && styles.goalTextSelected]} numberOfLines={1}>
								{GOAL_TYPE_LABELS[g]}
							</Text>
						</Pressable>
					);
				})}
			</View>
		</Card>
	);
}
