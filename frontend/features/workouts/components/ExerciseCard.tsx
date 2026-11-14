import { useMemo } from "react";
import { View, Text, Pressable, Alert, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReorderableListReorderEvent } from "react-native-reorderable-list";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/typography";
import type { ExerciseStats, WorkoutExercise, WorkoutSet } from "../types";
import { formatNumber } from "../utils/workoutEditor";
import { DragGrip } from "./DragGrip";
import { SetsTable } from "./SetsTable";

//One exercise in the editor: its name, best weight, sets table and "Add set"
export function ExerciseCard({
	exercise,
	index,
	total,
	stats,
	onChangeSet,
	onReorderSets,
	onAddSet,
	onRemove,
	onDeleteSet,
}: {
	exercise: WorkoutExercise;
	index: number;
	total: number;
	stats?: ExerciseStats;
	onChangeSet: (setKey: string, patch: Partial<WorkoutSet>) => void;
	onReorderSets: (event: ReorderableListReorderEvent) => void;
	onAddSet: () => void;
	onRemove: () => void;
	onDeleteSet: (setKey: string) => void;
}) {
	const { theme } = useTheme();
	const name = exercise.exercise_name || "Unnamed exercise";

	//only ask first if there's something to lose; an exercise you just added by mistake goes straight away
	const confirmRemove = () => {
		const hasData = exercise.sets.some((s) => s.weight != null || s.reps != null || s.reps_in_reserve != null);
		if (!hasData) return onRemove();
		Alert.alert(`Remove ${name}?`, "The sets you've logged for it will be removed too.", [
			{ text: "Cancel", style: "cancel" },
			{ text: "Remove", style: "destructive", onPress: onRemove },
		]);
	};

	const styles = useMemo(
		() =>
			StyleSheet.create({
				card: { backgroundColor: theme.cardBg, borderRadius: 18, borderWidth: 1, borderColor: theme.border, padding: 16 },
				header: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
				actions: { flexDirection: "row", alignItems: "center", gap: 14 },
				eyebrow: { fontSize: 13, fontWeight: "600", color: theme.primary },
				best: { fontSize: 13, fontWeight: "500", color: theme.textMuted },
				exerciseName: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 30, color: theme.text, marginBottom: 12 },
				addSetButton: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "center",
					gap: 4,
					height: 46,
					marginTop: 6,
					borderRadius: 14,
					borderWidth: 1,
					borderColor: theme.border,
					backgroundColor: theme.cardBgAlt,
				},
				addSetText: { fontSize: 15, fontWeight: "600", color: theme.textSecondary },
			}),
		[theme],
	);

	return (
		<View style={styles.card}>
			<View style={styles.header}>
				<View style={{ flex: 1 }}>
					<Text style={styles.eyebrow}>
						Exercise {index + 1} of {total}
						{stats?.best_weight != null && <Text style={styles.best}>{`  ·  Best: ${formatNumber(stats.best_weight)} lbs`}</Text>}
					</Text>
					<Text style={styles.exerciseName}>{name}</Text>
				</View>
				<View style={styles.actions}>
					<Pressable onPress={confirmRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${name}`}>
						<Ionicons name="trash-outline" size={18} color={theme.textTertiary} />
					</Pressable>
					{/* sits outside the sets list, so it drags the whole card rather than a set */}
					<DragGrip label={`Drag ${name} to reorder`} />
				</View>
			</View>

			<SetsTable exercise={exercise} previousSets={stats?.previous_sets} onChangeSet={onChangeSet} onReorderSets={onReorderSets} onDeleteSet={onDeleteSet} />

			<Pressable style={styles.addSetButton} onPress={onAddSet} accessibilityRole="button">
				<Ionicons name="add" size={18} color={theme.textSecondary} />
				<Text style={styles.addSetText}>Add set</Text>
			</Pressable>
		</View>
	);
}
