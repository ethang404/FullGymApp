import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useMemo } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";

export interface Recipe {
	id: string;
	name: string;
	servings: number;
	calories_per_serving: number;
	protein_per_serving: number;
	carbs_per_serving: number;
	fat_per_serving: number;
}

type RecipeCardProps = {
	recipe: Recipe;
	onPress: (recipe: Recipe) => void;
};

export default function RecipeDisplayCard({ recipe, onPress }: RecipeCardProps) {
	const { theme } = useTheme();

	const styles = useMemo(
		() =>
			StyleSheet.create({
				card: {
					backgroundColor: theme.cardBg,
					borderRadius: 16,
					paddingVertical: 14,
					paddingHorizontal: 16,
					marginBottom: 10,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.border,
				},
				topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
				nameCol: { flex: 1, paddingRight: 10 },
				name: { color: theme.text, fontSize: 15, fontWeight: "700" },
				servings: { color: theme.textTertiary, fontSize: 12, marginTop: 2 },
				calories: { color: theme.text, fontSize: 22, fontWeight: "700", minWidth: 34, textAlign: "right" },
				calLabel: { color: theme.textMuted, fontSize: 11, textAlign: "right" },
				macrosRow: { flexDirection: "row", gap: 14, marginTop: 10 },
				macroChip: { flexDirection: "row", alignItems: "center", gap: 4 },
				macroDot: { width: 6, height: 6, borderRadius: 3 },
				macroChipText: { fontSize: 12, fontWeight: "600", color: theme.textMuted },
				chevron: { marginLeft: 8, alignSelf: "center" },
			}),
		[theme],
	);

	return (
		<TouchableOpacity activeOpacity={0.7} style={styles.card} onPress={() => onPress(recipe)}>
			<View style={styles.topRow}>
				<View style={styles.nameCol}>
					<Text style={styles.name} numberOfLines={1}>
						{recipe.name}
					</Text>
					<Text style={styles.servings}>
						{recipe.servings} serving{recipe.servings === 1 ? "" : "s"}
					</Text>
				</View>

				<View>
					<Text style={styles.calories}>{Math.round(recipe.calories_per_serving)}</Text>
					<Text style={styles.calLabel}>kcal / serving</Text>
				</View>

				<FontAwesome5 name="chevron-right" size={12} color={theme.textMuted} style={styles.chevron} />
			</View>

			<View style={styles.macrosRow}>
				<View style={styles.macroChip}>
					<View style={[styles.macroDot, { backgroundColor: theme.macroProtein }]} />
					<Text style={styles.macroChipText}>{Math.round(recipe.protein_per_serving)}g P</Text>
				</View>
				<View style={styles.macroChip}>
					<View style={[styles.macroDot, { backgroundColor: theme.macroCarbs }]} />
					<Text style={styles.macroChipText}>{Math.round(recipe.carbs_per_serving)}g C</Text>
				</View>
				<View style={styles.macroChip}>
					<View style={[styles.macroDot, { backgroundColor: theme.macroFat }]} />
					<Text style={styles.macroChipText}>{Math.round(recipe.fat_per_serving)}g F</Text>
				</View>
			</View>
		</TouchableOpacity>
	);
}
