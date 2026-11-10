import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { formatRelativeDate } from "@/utils/date";
import type { WorkoutSummary } from "../types";

//One past workout in the Workouts tab list: name, date, and duration/volume when known
export function WorkoutListCard({ workout: w, onPress }: { workout: WorkoutSummary; onPress: () => void }) {
	const { theme } = useTheme();
	const styles = useMemo(
		() =>
			StyleSheet.create({
				card: {
					flexDirection: "row",
					alignItems: "center",
					backgroundColor: theme.cardBg,
					borderRadius: 14,
					padding: 14,
					borderWidth: 1,
					borderColor: theme.border,
					gap: 14,
				},
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
				name: {
					fontSize: 15,
					fontWeight: "700",
					color: theme.text,
				},
				date: {
					fontSize: 12,
					color: theme.textMuted,
					marginTop: 2,
				},
				stats: {
					flexDirection: "row",
					gap: 12,
					marginTop: 6,
				},
				stat: {
					flexDirection: "row",
					alignItems: "center",
					gap: 4,
				},
				statText: {
					fontSize: 11,
					color: theme.textSecondary,
				},
				chevron: {
					marginLeft: "auto",
				},
			}),
		[theme],
	);

	return (
		<TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
			<View style={styles.iconWrap}>
				<FontAwesome5 name="dumbbell" size={16} color={theme.primary} />
			</View>
			<View style={{ flex: 1 }}>
				<Text style={styles.name}>{w.name}</Text>
				<Text style={styles.date}>{formatRelativeDate(w.date)}</Text>
				{(w.duration_minutes || w.total_volume_kg) && (
					<View style={styles.stats}>
						{w.duration_minutes && (
							<View style={styles.stat}>
								<FontAwesome5 name="clock" size={10} color={theme.textTertiary} />
								<Text style={styles.statText}>{w.duration_minutes} min</Text>
							</View>
						)}
						{w.total_volume_kg && (
							<View style={styles.stat}>
								<FontAwesome5 name="weight-hanging" size={10} color={theme.textTertiary} />
								<Text style={styles.statText}>{w.total_volume_kg.toLocaleString()}kg</Text>
							</View>
						)}
					</View>
				)}
			</View>
			<FontAwesome5 name="chevron-right" size={12} color={theme.textTertiary} style={styles.chevron} />
		</TouchableOpacity>
	);
}
