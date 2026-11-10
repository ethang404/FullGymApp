import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { ACTIVITY_LEVELS, ACTIVITY_LABELS, type ActivityLevel } from "@/utils/macroDefaults";

const DETAILS: Record<ActivityLevel, { icon: string; description: string }> = {
	sedentary: { icon: "couch", description: "Desk job, not much walking during the day." },
	light: { icon: "walking", description: "Some walking, or light exercise 1–2 days a week." },
	moderate: { icon: "running", description: "Exercise 3–5 days a week." },
	active: { icon: "dumbbell", description: "Hard exercise most days, or on your feet at work." },
	very_active: { icon: "fire-alt", description: "Training twice a day, or a physical job." },
};

export function ActivityPicker({ value, onChange }: { value: ActivityLevel | null; onChange: (level: ActivityLevel) => void }) {
	const { theme } = useTheme();
	const styles = useMemo(
		() =>
			StyleSheet.create({
				list: { gap: 10 },
				option: {
					flexDirection: "row",
					alignItems: "center",
					gap: 14,
					padding: 14,
					borderRadius: 16,
					borderWidth: 1.5,
					borderColor: theme.border,
					backgroundColor: theme.cardBg,
				},
				optionSelected: { borderColor: theme.primary, backgroundColor: theme.cardBgAlt },
				icon: {
					width: 40,
					height: 40,
					borderRadius: 12,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: theme.cardBgAlt,
				},
				iconSelected: { backgroundColor: theme.primary },
				text: { flex: 1 },
				label: { color: theme.text, fontSize: 15, fontWeight: "700" },
				labelSelected: { color: theme.primary },
				description: { color: theme.textMuted, fontSize: 13, marginTop: 2 },
			}),
		[theme],
	);

	return (
		<View style={styles.list}>
			{ACTIVITY_LEVELS.map((level) => {
				const selected = value === level;
				return (
					<Pressable
						key={level}
						style={[styles.option, selected && styles.optionSelected]}
						onPress={() => onChange(level)}
						accessibilityRole="radio"
						accessibilityState={{ selected }}
					>
						<View style={[styles.icon, selected && styles.iconSelected]}>
							<FontAwesome5 name={DETAILS[level].icon} size={16} color={selected ? theme.textInverse : theme.textMuted} />
						</View>
						<View style={styles.text}>
							<Text style={[styles.label, selected && styles.labelSelected]}>{ACTIVITY_LABELS[level]}</Text>
							<Text style={styles.description}>{DETAILS[level].description}</Text>
						</View>
						{selected && <FontAwesome5 name="check-circle" size={16} color={theme.primary} solid />}
					</Pressable>
				);
			})}
		</View>
	);
}
