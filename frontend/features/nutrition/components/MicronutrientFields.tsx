import { useMemo } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { MicronutrientField } from "../types";

// The vitamins & minerals list on the create food form.
export function MicronutrientFields({ fields, onChange }: { fields: MicronutrientField[]; onChange: (nutrientId: number, value: string) => void }) {
	const { theme } = useTheme();
	const styles = useMemo(
		() =>
			StyleSheet.create({
				row: {
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					paddingVertical: 14,
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: theme.borderLight,
				},
				noBorder: {
					borderBottomWidth: 0,
				},
				label: {
					color: theme.textMuted,
					fontSize: 12,
					letterSpacing: 0.3,
					fontWeight: "600",
				},
				valueWrap: {
					flexDirection: "row",
					alignItems: "baseline",
				},
				input: {
					color: theme.text,
					fontSize: 15,
					fontWeight: "600",
					minWidth: 36,
					padding: 0,
				},
				unit: {
					color: theme.textMuted,
					fontSize: 12,
					marginLeft: 4,
				},
			}),
		[theme],
	);

	return (
		<>
			{fields.map((m, i) => (
				<View key={m.nutrient_id} style={[styles.row, i === fields.length - 1 && styles.noBorder]}>
					<Text style={styles.label}>{m.label}</Text>
					<View style={styles.valueWrap}>
						<TextInput style={styles.input} value={m.value} onChangeText={(v) => onChange(m.nutrient_id, v)} keyboardType="decimal-pad" textAlign="right" />
						<Text style={styles.unit}>{m.unit}</Text>
					</View>
				</View>
			))}
		</>
	);
}
