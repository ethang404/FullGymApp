import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import ReorderableList, { type ReorderableListReorderEvent } from "react-native-reorderable-list";
import { useTheme } from "@/theme/ThemeProvider";
import type { PreviousSet, WorkoutExercise, WorkoutSet } from "../types";
import { pairWithPrevious, setKey, setLabels } from "../utils/workoutEditor";
import { SetRow, SET_COLUMNS } from "./SetRow";

//Takes in an exercise and shows its sets: draggable rows with the working/warmup dropdown
export function SetsTable({
	exercise,
	previousSets = [],
	onChangeSet,
	onReorderSets,
	onDeleteSet,
}: {
	exercise: WorkoutExercise;
	previousSets?: PreviousSet[];
	onChangeSet: (setKey: string, patch: Partial<WorkoutSet>) => void;
	onReorderSets: (event: ReorderableListReorderEvent) => void;
	onDeleteSet: (setKey: string) => void;
}) {
	const { theme } = useTheme();
	const styles = useMemo(
		() =>
			StyleSheet.create({
				emptyText: { fontSize: 14, color: theme.textMuted, paddingVertical: 8 },
				header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, marginBottom: 8 },
				headerText: { fontSize: 12, fontWeight: "600", color: theme.textMuted },
				headerCenter: { textAlign: "center" },
				rowGap: { paddingBottom: 8 },
			}),
		[theme],
	);

	if (exercise.sets.length === 0) return <Text style={styles.emptyText}>No sets yet. Add one below.</Text>;

	const labels = setLabels(exercise.sets);
	const paired = pairWithPrevious(exercise.sets, previousSets);

	return (
		<View>
			<View style={styles.header}>
				<View style={{ width: SET_COLUMNS.grip }} />
				<Text style={[styles.headerText, { width: SET_COLUMNS.type }]}>Type</Text>
				<Text style={[styles.headerText, { flex: 1 }]}>Prev</Text>
				<Text style={[styles.headerText, styles.headerCenter, { width: SET_COLUMNS.lbs }]}>Lbs</Text>
				<Text style={[styles.headerText, styles.headerCenter, { width: SET_COLUMNS.reps }]}>Reps</Text>
				<Text style={[styles.headerText, styles.headerCenter, { width: SET_COLUMNS.rir }]}>RIR</Text>
				<View style={{ width: SET_COLUMNS.trash }} />
			</View>

			{/* drag a row by its grip; labels/prev follow the new array order automatically */}
			<ReorderableList
				data={exercise.sets}
				keyExtractor={setKey}
				onReorder={onReorderSets}
				scrollEnabled={false} //grows to fit its rows; the exercise list does the scrolling
				keyboardShouldPersistTaps="handled"
				renderItem={({ item, index }) => (
					<View style={styles.rowGap}>
						<SetRow
							set={item}
							label={labels[index]}
							previous={paired[index]}
							onChange={(patch) => onChangeSet(setKey(item), patch)}
							onRemove={() => onDeleteSet(setKey(item))}
						/>
					</View>
				)}
			/>
		</View>
	);
}
