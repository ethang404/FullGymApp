import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useMemo } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { formatRelativeDate } from "@/utils/date";
import type { ExploreItem } from "../../types/explore";

const VISIBILITY_ICON = { public: "globe-americas", friends: "user-friends", private: "lock" } as const;

interface Props {
	item: ExploreItem;
	onPress: () => void;
}

export default function ExploreCard({ item, onPress }: Props) {
	const { theme } = useTheme();
	const isRecipe = item.type === "recipe";

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
				topRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
				iconWrap: {
					width: 44,
					height: 44,
					borderRadius: 13,
					backgroundColor: theme.cardBgAlt,
					alignItems: "center",
					justifyContent: "center",
					borderWidth: 1,
					borderColor: theme.border,
				},
				nameCol: { flex: 1 },
				name: { color: theme.text, fontSize: 15, fontWeight: "700" },
				meta: { color: theme.textTertiary, fontSize: 12, marginTop: 2 },
				chevron: { alignSelf: "center" },
				macrosRow: { flexDirection: "row", gap: 14, marginTop: 12 },
				macroChip: { flexDirection: "row", alignItems: "center", gap: 4 },
				macroDot: { width: 6, height: 6, borderRadius: 3 },
				macroChipText: { fontSize: 12, fontWeight: "600", color: theme.textMuted },
				authorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
				authorName: { flex: 1, color: theme.textSecondary, fontSize: 12, fontWeight: "600" },
				authorMeta: { color: theme.textTertiary, fontSize: 11 },
			}),
		[theme],
	);

	return (
		<TouchableOpacity activeOpacity={0.7} style={styles.card} onPress={onPress}>
			<View style={styles.topRow}>
				<View style={styles.iconWrap}>
					<FontAwesome5 name={isRecipe ? "utensils" : "dumbbell"} size={16} color={theme.primary} />
				</View>
				<View style={styles.nameCol}>
					<Text style={styles.name} numberOfLines={1}>
						{item.name}
					</Text>
					<Text style={styles.meta}>
						{isRecipe
							? `${item.servings} serving${item.servings === 1 ? "" : "s"} · ${Math.round(item.calories_per_serving)} kcal`
							: formatRelativeDate(item.workout_date)}
					</Text>
				</View>
				<FontAwesome5 name="chevron-right" size={12} color={theme.textMuted} style={styles.chevron} />
			</View>

			{isRecipe && (
				<View style={styles.macrosRow}>
					<View style={styles.macroChip}>
						<View style={[styles.macroDot, { backgroundColor: theme.macroProtein }]} />
						<Text style={styles.macroChipText}>{Math.round(item.protein_per_serving)}g P</Text>
					</View>
					<View style={styles.macroChip}>
						<View style={[styles.macroDot, { backgroundColor: theme.macroCarbs }]} />
						<Text style={styles.macroChipText}>{Math.round(item.carbs_per_serving)}g C</Text>
					</View>
					<View style={styles.macroChip}>
						<View style={[styles.macroDot, { backgroundColor: theme.macroFat }]} />
						<Text style={styles.macroChipText}>{Math.round(item.fat_per_serving)}g F</Text>
					</View>
				</View>
			)}

			<View style={styles.authorRow}>
				<FontAwesome5 name={VISIBILITY_ICON[item.visibility]} size={10} color={theme.textTertiary} />
				<Text style={styles.authorName} numberOfLines={1}>
					@{item.user_name}
				</Text>
				<Text style={styles.authorMeta}>{formatRelativeDate(item.created_at)}</Text>
			</View>
		</TouchableOpacity>
	);
}
