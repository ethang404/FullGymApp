import { ScrollView, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useMemo } from "react";
import { useTheme } from "@/theme/ThemeProvider";

// A horizontally-scrolling single-select chip row — the "All / Shared Recipes / Daily
// Workouts"-style filter strip from the reference design. Unlike Pills (which wraps),
// this scrolls, matching the reference screenshot's single scrolling row.
export default function FilterChips<T extends string>({
	options,
	value,
	onSelect,
	labels,
}: {
	options: readonly T[];
	value: T;
	onSelect: (v: T) => void;
	labels?: Record<string, string>;
}) {
	const { theme } = useTheme();

	const styles = useMemo(
		() =>
			StyleSheet.create({
				content: { flexDirection: "row", gap: 8, paddingRight: 4 },
				chip: {
					paddingHorizontal: 14,
					paddingVertical: 8,
					borderRadius: 999,
					borderWidth: 1.5,
					borderColor: theme.border,
					backgroundColor: theme.cardBg,
				},
				chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
				chipText: { fontSize: 13, fontWeight: "600", color: theme.textMuted },
				chipTextActive: { color: theme.textInverse },
			}),
		[theme],
	);

	return (
		<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
			{options.map((opt) => {
				const active = opt === value;
				return (
					<TouchableOpacity key={opt} style={[styles.chip, active && styles.chipActive]} onPress={() => onSelect(opt)} activeOpacity={0.8}>
						<Text style={[styles.chipText, active && styles.chipTextActive]}>{labels?.[opt] ?? opt}</Text>
					</TouchableOpacity>
				);
			})}
		</ScrollView>
	);
}
