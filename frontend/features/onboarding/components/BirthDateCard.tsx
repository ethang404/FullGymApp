import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { DateField } from "@/components/DateField";
import { formatMediumDate, parseISODate } from "@/utils/date";
import { Card, CardHeader } from "./Card";

// Whole years since `iso` (YYYY-MM-DD), or null if it isn't a usable date.
function ageFrom(iso: string): number | null {
	const birth = parseISODate(iso);
	if (!birth) return null;
	const now = new Date();
	let age = now.getFullYear() - birth.getFullYear();
	const beforeBirthday = now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
	if (beforeBirthday) age -= 1;
	return age >= 0 ? age : null;
}

export function BirthDateCard({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
	const { theme } = useTheme();
	const age = ageFrom(value);

	const styles = useMemo(
		() =>
			StyleSheet.create({
				// wrap: on iOS DateField renders its spinner after the button, and it needs its own line
				row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
				header: { flex: 1 },
				pill: {
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
					backgroundColor: theme.cardBgAlt,
					borderRadius: 12,
					paddingHorizontal: 12,
					paddingVertical: 10,
				},
				pillText: { color: theme.text, fontSize: 15, fontWeight: "600" },
				placeholder: { color: theme.textMuted },
			}),
		[theme],
	);

	return (
		<Card>
			<View style={styles.row}>
				<View style={styles.header}>
					<CardHeader title="Date of birth" subtitle={age != null ? `You're ${age}` : "Used to work out your age"} />
				</View>
				<DateField value={value} onChange={onChange} fieldStyle={styles.pill} accessibilityLabel="Date of birth">
					<FontAwesome5 name="calendar-alt" size={14} color={theme.primary} />
					<Text style={[styles.pillText, !value && styles.placeholder]}>{value ? formatMediumDate(value) : "Pick a date"}</Text>
				</DateField>
			</View>
		</Card>
	);
}
