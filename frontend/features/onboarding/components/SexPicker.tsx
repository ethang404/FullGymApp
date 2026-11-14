import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { SEXES, type Sex } from "@/utils/macroDefaults";

const OPTIONS: Record<Sex, { label: string; icon: string }> = {
	male: { label: "Male", icon: "mars" },
	female: { label: "Female", icon: "venus" },
};

export function SexPicker({ value, onChange }: { value: Sex | null; onChange: (sex: Sex) => void }) {
	const { theme } = useTheme();
	const styles = useMemo(
		() =>
			StyleSheet.create({
				row: { flexDirection: "row", gap: 10 },
				tile: {
					flex: 1,
					alignItems: "center",
					gap: 8,
					paddingVertical: 16,
					borderRadius: 16,
					borderWidth: 1.5,
					borderColor: theme.border,
					backgroundColor: theme.cardBg,
				},
				tileSelected: { borderColor: theme.primary, backgroundColor: theme.cardBgAlt },
				iconCircle: {
					width: 40,
					height: 40,
					borderRadius: 20,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: theme.cardBgAlt,
				},
				iconCircleSelected: { backgroundColor: theme.primary },
				label: { color: theme.textMuted, fontSize: 14, fontWeight: "600" },
				labelSelected: { color: theme.text },
			}),
		[theme],
	);

	return (
		<View style={styles.row}>
			{SEXES.map((sex) => {
				const selected = value === sex;
				return (
					<Pressable
						key={sex}
						style={[styles.tile, selected && styles.tileSelected]}
						onPress={() => onChange(sex)}
						accessibilityRole="radio"
						accessibilityState={{ selected }}
					>
						<View style={[styles.iconCircle, selected && styles.iconCircleSelected]}>
							<FontAwesome5 name={OPTIONS[sex].icon} size={18} color={selected ? theme.textInverse : theme.textMuted} />
						</View>
						<Text style={[styles.label, selected && styles.labelSelected]}>{OPTIONS[sex].label}</Text>
					</Pressable>
				);
			})}
		</View>
	);
}
