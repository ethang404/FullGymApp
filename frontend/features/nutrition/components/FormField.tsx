import { useMemo, type ReactNode } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

// A labelled text input row on the create food form, with an optional button on the right.
// Lives in its own file (not inside the screen) so its identity is stable across renders -
// a component recreated on every render remounts its TextInput and kicks the user out of the field.
export function FormField({
	label,
	placeholder,
	value,
	onChangeText,
	isLast,
	rightElement,
}: {
	label: string;
	placeholder: string;
	value: string;
	onChangeText: (v: string) => void;
	isLast?: boolean;
	rightElement?: ReactNode;
}) {
	const { theme } = useTheme();
	const styles = useMemo(
		() =>
			StyleSheet.create({
				field: {
					marginTop: 16,
					paddingBottom: 12,
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: theme.borderLight,
				},
				fieldLast: {
					borderBottomWidth: 0,
				},
				label: {
					color: theme.textMuted,
					fontSize: 11,
					fontWeight: "600",
					marginBottom: 8,
				},
				inputRow: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
				},
				input: {
					color: theme.text,
					fontSize: 16,
					padding: 0,
					flex: 1,
				},
			}),
		[theme],
	);

	return (
		<View style={[styles.field, isLast && styles.fieldLast]}>
			<Text style={styles.label}>{label}</Text>
			<View style={styles.inputRow}>
				<TextInput style={styles.input} placeholder={placeholder} placeholderTextColor={theme.inputPlaceholder} value={value} onChangeText={onChangeText} />
				{rightElement}
			</View>
		</View>
	);
}
