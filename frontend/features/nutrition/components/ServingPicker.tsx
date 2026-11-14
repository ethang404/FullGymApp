import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { ServingSize } from "../types";

// A row of serving pills ("oz (28g)", "cup (240g)"...) plus a "+" pill to add one.
export function ServingPicker({
	servings,
	selected,
	onSelect,
	onAddPress,
}: {
	servings: ServingSize[];
	selected: ServingSize | null;
	onSelect: (serving: ServingSize) => void;
	onAddPress: () => void;
}) {
	const { theme } = useTheme();
	const styles = useMemo(
		() =>
			StyleSheet.create({
				row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 4 },
				pill: {
					paddingVertical: 6,
					paddingHorizontal: 12,
					borderRadius: 20,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.border,
				},
				pillSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
				pillText: { fontSize: 12, fontWeight: "600", color: theme.text },
				pillTextSelected: { color: theme.cardBg },
			}),
		[theme],
	);

	return (
		<View style={styles.row}>
			{servings.map((opt) => {
				const isSelected = opt.label === selected?.label && opt.weight_g === selected?.weight_g;
				return (
					<TouchableOpacity key={opt.label} style={[styles.pill, isSelected && styles.pillSelected]} onPress={() => onSelect(opt)}>
						<Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
							{opt.label} ({opt.weight_g}g)
						</Text>
					</TouchableOpacity>
				);
			})}
			<TouchableOpacity style={styles.pill} onPress={onAddPress}>
				<Text style={styles.pillText}> + </Text>
			</TouchableOpacity>
		</View>
	);
}
