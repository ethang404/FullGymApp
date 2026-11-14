import { useLocalSearchParams, router } from "expo-router";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import ReorderableList from "react-native-reorderable-list";

import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/typography";
import { toast } from "@/utils/toast";
import { formatMediumDate } from "@/utils/date";
import Screen from "@/components/Screen";
import { ScreenState } from "@/components/ScreenState";
import LoadingScreen from "@/components/LoadingScreen";

import type { WorkoutData, WorkoutMode } from "@/features/workouts/types";
import { exerciseKey } from "@/features/workouts/utils/workoutEditor";
import { useWorkout } from "@/features/workouts/hooks/useWorkout";
import { useWorkoutEditor } from "@/features/workouts/hooks/useWorkoutEditor";
import { useExerciseStats } from "@/features/workouts/hooks/useExerciseStats";
import { ExerciseCard } from "@/features/workouts/components/ExerciseCard";
import { ExercisePicker } from "@/features/workouts/components/ExercisePicker";
import { WorkoutCelebration } from "@/features/workouts/components/WorkoutCelebration";

//space between exercise cards: the reorderable list measures its cells, so it can't use a gap
const ExerciseGap = () => <View style={{ height: 14 }} />;

//new / edit
function EditWorkout({
	workout,
	setWorkout,
	workoutId,
}: {
	workout: WorkoutData;
	setWorkout: Dispatch<SetStateAction<WorkoutData>>;
	workoutId?: number; // only when editing a saved workout, so its own sets don't show up as "prev"
}) {
	const { theme } = useTheme();
	const editor = useWorkoutEditor(workout, setWorkout, workoutId);

	const catalogIds = workout.exercises.map((e) => e.catalog_id).filter((id): id is number => id != null);
	const stats = useExerciseStats(catalogIds, workoutId);

	// UI-only state: the exercise picker sheet and the "workout done" celebration
	const [pickerOpen, setPickerOpen] = useState(false);
	const [celebrating, setCelebrating] = useState(false);

	const handleSave = async () => {
		const result = await editor.save();
		if (result === "updated") {
			toast.success("Workout saved.");
			router.back();
		} else if (result === "created") {
			setCelebrating(true); //goes back when it's dismissed
		}
	};

	const styles = useMemo(
		() =>
			StyleSheet.create({
				//no gap here: the reorderable list measures its cells, so spacing comes from ExerciseGap / listHeader instead
				listContent: { padding: 16, paddingBottom: 48 },
				listHeader: { marginBottom: 14, gap: 12 },
				listFooter: { marginTop: 14, gap: 12 },
				addExerciseButton: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "center",
					gap: 6,
					height: 52,
					borderRadius: 18,
					borderWidth: 1.5,
					borderStyle: "dashed",
					borderColor: theme.primary,
				},
				addExerciseText: { fontSize: 16, fontWeight: "700", color: theme.primary },
				saveButton: { height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: theme.primary },
				saveButtonText: { fontSize: 16, fontWeight: "700", color: theme.textInverse },
				disabled: { opacity: 0.6 },
				headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 2 },
				titleInput: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 34, color: theme.text, padding: 0 },
				subtitle: { fontSize: 14, color: theme.textMuted },
				emptyText: { fontSize: 14, color: theme.textMuted, paddingVertical: 8 },
			}),
		[theme],
	);

	return (
		<Screen>
			<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
				{/* the exercise list IS the screen's scroller (a FlatList), so the set lists inside it are FlatList-in-FlatList,
				    which RN allows. Putting them in a ScrollView instead triggers the "VirtualizedLists should never be nested" error */}
				<ReorderableList
					data={workout.exercises}
					keyExtractor={exerciseKey}
					onReorder={editor.reorderExercises}
					contentContainerStyle={styles.listContent}
					keyboardShouldPersistTaps="handled"
					ItemSeparatorComponent={ExerciseGap}
					//elements, not components: an inline component would remount every render and the name box would lose focus
					ListHeaderComponent={
						<View style={styles.listHeader}>
							<View style={styles.headerRow}>
								<Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back">
									<Ionicons name="chevron-back" size={24} color={theme.primary} />
								</Pressable>
								<View style={{ flex: 1 }}>
									<TextInput
										style={styles.titleInput}
										value={workout.workout_name}
										onChangeText={editor.setName}
										placeholder="Workout name"
										placeholderTextColor={theme.inputPlaceholder}
									/>
									<Text style={styles.subtitle}>{formatMediumDate(workout.workout_date)}</Text>
								</View>
							</View>
						</View>
					}
					ListEmptyComponent={<Text style={styles.emptyText}>No exercises yet. Add one below.</Text>}
					ListFooterComponent={
						<View style={styles.listFooter}>
							<Pressable style={styles.addExerciseButton} onPress={() => setPickerOpen(true)} accessibilityRole="button">
								<Ionicons name="add" size={20} color={theme.primary} />
								<Text style={styles.addExerciseText}>Add exercise</Text>
							</Pressable>
							<Pressable style={[styles.saveButton, editor.saving && styles.disabled]} onPress={handleSave} disabled={editor.saving} accessibilityRole="button">
								{editor.saving ? (
									<ActivityIndicator color={theme.textInverse} />
								) : (
									<Text style={styles.saveButtonText}>{editor.isEditing ? "Save changes" : "Finish workout"}</Text>
								)}
							</Pressable>
						</View>
					}
					renderItem={({ item: exercise, index }) => {
						const exKey = exerciseKey(exercise);
						return (
							<ExerciseCard
								exercise={exercise}
								index={index}
								total={workout.exercises.length}
								stats={exercise.catalog_id != null ? stats[exercise.catalog_id] : undefined}
								onChangeSet={(sKey, patch) => editor.updateSet(exKey, sKey, patch)}
								onReorderSets={(event) => editor.reorderSets(exKey, event)}
								onAddSet={() => editor.addSet(exKey)}
								onRemove={() => editor.removeExercise(exKey)}
								onDeleteSet={(sKey) => editor.deleteSet(exKey, sKey)}
							/>
						);
					}}
				/>
			</KeyboardAvoidingView>

			<ExercisePicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={editor.addExercise} />

			<WorkoutCelebration
				visible={celebrating}
				exerciseCount={workout.exercises.length}
				setCount={workout.exercises.reduce((n, e) => n + e.sets.length, 0)}
				onDone={() => {
					setCelebrating(false);
					router.back();
				}}
			/>
		</Screen>
	);
}

export default function Workout() {
	const params = useLocalSearchParams<{
		workout_id?: string;
		mode?: WorkoutMode;
		//edit = modifiyng an old workout
		//new = no fetch, blank
	}>();
	const mode = params.mode ?? "edit"; // Home's recent workouts link doesn't pass a mode
	const { workout_id } = params;

	const { workout, setWorkout, loading, error, retry } = useWorkout(workout_id, mode);

	if (loading) return <LoadingScreen />;

	//never show the editor without the real workout loaded (see the error state in useWorkout)
	if (error)
		return (
			<Screen>
				<ScreenState error onRetry={retry} errorTitle="Couldn't load this workout">
					{null}
				</ScreenState>
			</Screen>
		);

	return <EditWorkout workout={workout} setWorkout={setWorkout} workoutId={mode === "edit" ? Number(workout_id) : undefined} />;
}
