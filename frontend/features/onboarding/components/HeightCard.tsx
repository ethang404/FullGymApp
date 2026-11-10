import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/typography";
import SegmentedControl from "@/components/SegmentedControl";
import Slider from "@/components/Slider";
import { Card, CardHeader } from "./Card";

// Value in and out is always centimetres as a string (what the API stores). The unit
// toggle only changes what's shown: in ft / in mode the slider moves in whole inches.

const CM_PER_IN = 2.54;
const UNITS = ["ft", "cm"] as const;
type Unit = (typeof UNITS)[number];

const RANGE: Record<Unit, { min: number; max: number }> = {
	ft: { min: 48, max: 86 }, // inches: 4' 0" to 7' 2"
	cm: { min: 120, max: 220 },
};

const feetInches = (totalIn: number) => `${Math.floor(totalIn / 12)}' ${totalIn % 12}"`;
const spokenFeetInches = (totalIn: number) => `${Math.floor(totalIn / 12)} feet ${totalIn % 12} inches`;

export function HeightCard({ value, onChange }: { value: string; onChange: (cm: string) => void }) {
	const { theme } = useTheme();
	const [unit, setUnit] = useState<Unit>("ft");

	const parsed = parseFloat(value);
	const cm = parsed > 0 ? parsed : null;
	const inches = cm == null ? null : Math.round(cm / CM_PER_IN);
	const sliderValue = unit === "cm" ? (cm == null ? null : Math.round(cm)) : inches;
	const { min, max } = RANGE[unit];

	function setFromSlider(n: number) {
		const nextCm = unit === "cm" ? n : n * CM_PER_IN;
		onChange(String(Math.round(nextCm * 10) / 10));
	}

	function nudge(delta: 1 | -1) {
		const base = sliderValue ?? Math.round((min + max) / 2);
		setFromSlider(Math.min(max, Math.max(min, base + delta)));
	}

	const styles = useMemo(
		() =>
			StyleSheet.create({
				toggle: { width: 112 },
				valueRow: { flexDirection: "row", alignItems: "center", marginTop: 14, marginBottom: 6 },
				valueText: { flex: 1 },
				big: { color: theme.text, fontSize: 36, lineHeight: 42, fontFamily: fonts.heading },
				bigUnit: { color: theme.textMuted, fontSize: 15, fontFamily: fonts.headingMedium },
				empty: { color: theme.textTertiary },
				conversion: { color: theme.primary, fontSize: 13, fontWeight: "600" },
				stepper: { flexDirection: "row", gap: 8 },
				stepButton: {
					width: 36,
					height: 36,
					borderRadius: 10,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: theme.cardBgAlt,
				},
				rangeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
				rangeText: { color: theme.textTertiary, fontSize: 12 },
			}),
		[theme],
	);

	const display =
		cm == null ? (
			<Text style={[styles.big, styles.empty]}>{unit === "cm" ? "— cm" : "— ft"}</Text>
		) : unit === "cm" ? (
			<Text style={styles.big}>
				{Math.round(cm)} <Text style={styles.bigUnit}>cm</Text>
			</Text>
		) : (
			<Text style={styles.big}>{feetInches(inches!)}</Text>
		);

	const conversion = cm == null ? "Drag the slider to set" : unit === "cm" ? feetInches(inches!) : `${Math.round(cm)} cm`;

	return (
		<Card>
			<CardHeader
				title="Height"
				right={
					<View style={styles.toggle}>
						<SegmentedControl options={UNITS} value={unit} onChange={setUnit} labels={{ ft: "ft / in", cm: "cm" }} />
					</View>
				}
			/>

			<View style={styles.valueRow}>
				<View style={styles.valueText}>
					{display}
					<Text style={styles.conversion}>{conversion}</Text>
				</View>
				<View style={styles.stepper}>
					<Pressable style={styles.stepButton} onPress={() => nudge(-1)} accessibilityRole="button" accessibilityLabel="Shorter" hitSlop={4}>
						<FontAwesome5 name="minus" size={12} color={theme.text} />
					</Pressable>
					<Pressable style={styles.stepButton} onPress={() => nudge(1)} accessibilityRole="button" accessibilityLabel="Taller" hitSlop={4}>
						<FontAwesome5 name="plus" size={12} color={theme.text} />
					</Pressable>
				</View>
			</View>

			<Slider
				min={min}
				max={max}
				step={1}
				value={sliderValue}
				onChange={setFromSlider}
				accessibilityLabel="Height"
				formatValue={unit === "cm" ? (n) => `${n} centimetres` : spokenFeetInches}
			/>
			<View style={styles.rangeRow}>
				<Text style={styles.rangeText}>{unit === "cm" ? `${min} cm` : feetInches(min)}</Text>
				<Text style={styles.rangeText}>{unit === "cm" ? `${max} cm` : feetInches(max)}</Text>
			</View>
		</Card>
	);
}
