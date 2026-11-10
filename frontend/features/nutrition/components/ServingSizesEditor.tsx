import { useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/ThemeProvider";
import type { ServingSizeRow } from "../types";

// The serving size table on the create food form: unit (opens a picker), quantity, grams.
export function ServingSizesEditor({
	rows,
	onPressUnit,
	onChangeRow,
}: {
	rows: ServingSizeRow[];
	onPressUnit: (index: number) => void;
	onChangeRow: (index: number, field: "qty" | "weight_g", value: string) => void;
}) {
	const { theme } = useTheme();
	const styles = useMemo(
		() =>
			StyleSheet.create({
				headerRow: {
					flexDirection: "row",
					marginTop: 14,
				},
				headerText: {
					color: theme.textMuted,
					fontSize: 10,
					fontWeight: "600",
				},
				row: {
					flexDirection: "row",
					alignItems: "center",
					marginTop: 10,
					paddingBottom: 10,
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: theme.borderLight,
				},
				noBorder: {
					borderBottomWidth: 0,
				},
				input: {
					color: theme.text,
					fontSize: 16,
					padding: 0,
				},
				unitSuffix: {
					color: theme.textMuted,
					fontSize: 12,
					marginLeft: 4,
				},
				unitSelect: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					paddingRight: 8,
				},
				unitSelectText: {
					color: theme.text,
					fontSize: 16,
				},
				unitSelectPlaceholder: {
					color: theme.inputPlaceholder,
					fontSize: 16,
				},
			}),
		[theme],
	);

	return (
		<>
			<View style={styles.headerRow}>
				<Text style={[styles.headerText, { flex: 1.6 }]}>Name</Text>
				<Text style={[styles.headerText, { flex: 1, textAlign: "right" }]}>Qty</Text>
				<Text style={[styles.headerText, { flex: 1.5, textAlign: "right" }]}>Weight (g)</Text>
			</View>

			{rows.map((row, index) => (
				<View key={index} style={[styles.row, index === rows.length - 1 && styles.noBorder]}>
					<TouchableOpacity style={[styles.unitSelect, { flex: 1.6 }]} onPress={() => onPressUnit(index)} activeOpacity={0.7}>
						<Text style={row.name ? styles.unitSelectText : styles.unitSelectPlaceholder} numberOfLines={1}>
							{row.name || "Select"}
						</Text>
						<Ionicons name="chevron-down" size={14} color={theme.textMuted} />
					</TouchableOpacity>
					<TextInput
						style={[styles.input, { flex: 1, textAlign: "right" }]}
						value={row.qty}
						onChangeText={(v) => onChangeRow(index, "qty", v)}
						keyboardType="decimal-pad"
						placeholder="Qty"
						placeholderTextColor={theme.inputPlaceholder}
					/>
					<View style={{ flex: 1.5, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" }}>
						<TextInput
							style={[styles.input, { textAlign: "right" }]}
							value={row.weight_g}
							onChangeText={(v) => onChangeRow(index, "weight_g", v)}
							keyboardType="decimal-pad"
							placeholder="0"
							placeholderTextColor={theme.inputPlaceholder}
						/>
						<Text style={styles.unitSuffix}>G</Text>
					</View>
				</View>
			))}
		</>
	);
}
