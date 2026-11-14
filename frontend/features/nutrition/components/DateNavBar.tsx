import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useMemo } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/typography";
import { getWeekDates, parseISODate, todayISO } from "@/utils/date";
import { DateField } from "@/components/DateField";

interface DateNavBarProps {
	selectedDate: string;
	onChange: (date: string) => void;
}

// Week strip day switcher. Owns no state - the screen holds selectedDate (it needs it
// to fetch and to log), this just shows it and reports which day was asked for.
export default function DateNavBar({ selectedDate, onChange }: DateNavBarProps) {
	const { theme } = useTheme();

	const weekDates = getWeekDates(selectedDate); //list of dates for curr week
	const today = todayISO();
	const todayInView = weekDates.includes(today); //if not, offer a jump back
	const heading = parseISODate(selectedDate)?.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) ?? "";

	const styles = useMemo(
		() =>
			StyleSheet.create({
				dateHeader: {
					flexDirection: "row",
					flexWrap: "wrap", // lets the iOS date spinner drop onto its own line
					justifyContent: "space-between",
					alignItems: "center",
					gap: 8,
					marginHorizontal: 16,
					marginTop: 8,
					marginBottom: 8,
				},
				headingText: { color: theme.text, fontSize: 20, fontFamily: fonts.heading, flex: 1 },
				todayButton: {
					height: 36,
					paddingHorizontal: 12,
					borderRadius: 10,
					justifyContent: "center",
					backgroundColor: theme.cardBg,
				},
				todayButtonText: { color: theme.primary, fontSize: 13, fontWeight: "600" },
				calendarButton: {
					width: 36,
					height: 36,
					borderRadius: 10,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: theme.cardBg,
				},
				dateBar: {
					flexDirection: "row",
					backgroundColor: theme.cardBg,
					borderRadius: 14,
					padding: 6,
					gap: 4,
					marginHorizontal: 16,
				},
				dateBox: {
					flex: 1,
					alignItems: "center",
					paddingVertical: 8,
					borderRadius: 10,
					gap: 4,
					// transparent border on every cell so selecting one doesn't shift the layout by 1px
					borderWidth: 1,
					borderColor: "transparent",
				},
				dateBoxSelected: { backgroundColor: theme.primary, borderColor: theme.border },
				dayLetter: { fontSize: 11, fontWeight: "600", color: theme.textMuted },
				dayNumber: { fontSize: 16, fontWeight: "600", color: theme.textSecondary, fontVariant: ["tabular-nums"] },
				dayNumberToday: { color: theme.primary },
				selectedText: { color: theme.text },
			}),
		[theme],
	);

	return (
		<View>
			<View style={styles.dateHeader}>
				<Text style={styles.headingText} accessibilityRole="header">
					{heading}
				</Text>
				{/* Siblings of DateField (not wrapped in their own row) so the iOS spinner can still wrap below the header */}
				{!todayInView && (
					<TouchableOpacity style={styles.todayButton} onPress={() => onChange(today)} accessibilityRole="button" accessibilityLabel="Go to today">
						<Text style={styles.todayButtonText}>Today</Text>
					</TouchableOpacity>
				)}
				<DateField value={selectedDate} onChange={onChange} fieldStyle={styles.calendarButton} accessibilityLabel="Pick a date">
					<FontAwesome5 name="calendar-alt" size={16} color={theme.textSecondary} />
				</DateField>
			</View>

			<View style={styles.dateBar}>
				{weekDates.map((iso) => {
					const date = parseISODate(iso);
					if (!date) return null;

					const isSelected = iso === selectedDate;
					const isToday = iso === today;

					return (
						<TouchableOpacity
							key={iso}
							style={[styles.dateBox, isSelected && styles.dateBoxSelected]}
							onPress={() => onChange(iso)}
							accessibilityRole="button"
							accessibilityLabel={date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) + (isToday ? ", today" : "")}
							accessibilityState={{ selected: isSelected }}
						>
							<Text style={[styles.dayLetter, isSelected && styles.selectedText]}>{date.toLocaleDateString("en-US", { weekday: "narrow" })}</Text>
							<Text style={[styles.dayNumber, isToday && styles.dayNumberToday, isSelected && styles.selectedText]}>{date.getDate()}</Text>
						</TouchableOpacity>
					);
				})}
			</View>
		</View>
	);
}
