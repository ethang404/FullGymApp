import { useMemo } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

// One macro on the create food form: colored bar, label, number input and unit.
export function MacroInputRow({
	label,
	value,
	onChangeText,
	unit,
	barColor,
	isLast,
}: {
	label: string;
	value: string;
	onChangeText: (v: string) => void;
	unit: string;
	barColor?: string;
	isLast?: boolean;
}) {
	const { theme } = useTheme();
	const styles = useMemo(
		() =>
			StyleSheet.create({
				row: {
					flexDirection: "row",
					alignItems: "center",
					paddingVertical: 16,
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: theme.borderLight,
				},
				noBorder: {
					borderBottomWidth: 0,
				},
				bar: {
					width: 3,
					height: 20,
					borderRadius: 2,
					marginRight: 14,
				},
				barSpacer: {
					width: 3,
					marginRight: 14,
				},
				label: {
					color: theme.text,
					fontSize: 15,
					fontWeight: "600",
					flex: 1,
				},
				valueWrap: {
					flexDirection: "row",
					alignItems: "baseline",
				},
				input: {
					color: theme.text,
					fontSize: 20,
					fontWeight: "700",
					minWidth: 50,
					padding: 0,
				},
				unit: {
					color: theme.textMuted,
					fontSize: 13,
					marginLeft: 6,
				},
			}),
		[theme],
	);

	return (
		<View style={[styles.row, isLast && styles.noBorder]}>
			{barColor ? <View style={[styles.bar, { backgroundColor: barColor }]} /> : <View style={styles.barSpacer} />}
			<Text style={styles.label}>{label}</Text>
			<View style={styles.valueWrap}>
				<TextInput
					style={styles.input}
					value={value}
					onChangeText={onChangeText}
					keyboardType="decimal-pad"
					placeholder="0"
					placeholderTextColor={theme.inputPlaceholder}
					textAlign="right"
				/>
				<Text style={styles.unit}>{unit}</Text>
			</View>
		</View>
	);
}
