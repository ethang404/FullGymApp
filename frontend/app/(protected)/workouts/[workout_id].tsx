import { useLocalSearchParams, router } from "expo-router";
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	Pressable,
	ActivityIndicator,
	TouchableOpacity,
	Modal,
	Alert,
	KeyboardAvoidingView,
	Platform,
	type StyleProp,
	type TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { memo, useEffect, useState, useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { randomUUID } from "expo-crypto";
import ReorderableList, { reorderItems, useReorderableDrag, type ReorderableListReorderEvent } from "react-native-reorderable-list";

import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/typography";
import type { Theme } from "@/theme/colors";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import { toast } from "@/utils/toast";
import { todayISO, formatMediumDate } from "@/utils/date";
import Screen from "@/components/Screen";
import { ScreenState } from "@/components/ScreenState";
import { WorkoutCelebration } from "@/components/WorkoutCelebration";
import { haptics } from "@/utils/haptics";
import * as types from "@/types/workouts";

import LoadingScreen from "@/components/LoadingScreen";
import { ExercisePicker } from "@/features/workouts/components/ExercisePicker";

//default state of workout. A function (not a constant) so the date is "today" when the screen opens,
//not whenever the app first loaded this file.
function makeEmptyWorkout(): types.WorkoutData {
	return {
		workout_name: "",
		workout_date: todayISO(), //local calendar date ("2026-10-06"). toISOString() is UTC and can already be tomorrow in the evening
		notes: "",
		created_at: new Date().toISOString(), //an exact moment, so UTC is right here
		finished_at: null,
		exercises: [],
	};
}

// ---------------- Helpers ----------------

//stable keys: database id if saved, tempId if not
const exerciseKey = (e: types.WorkoutExercise) => String(e.exercise_id ?? e.tempId);
const setKey = (s: types.WorkoutSet) => String(s.set_id ?? s.tempId);

//array position is the source of truth for order; order_number just mirrors it (1-based, like the backend expects)
const renumber = <T extends { order_number: number }>(items: T[]) => items.map((item, i) => ({ ...item, order_number: i + 1 }));

//157.5 -> "157.5", null -> "–"
const formatNumber = (n: number | null | undefined) => (n == null ? "–" : String(n));

//"W" for warmups, working sets numbered 1, 2, 3... (warmups don't count toward the number)
function setLabels(sets: types.WorkoutSet[]) {
	let working = 0;
	return sets.map((s) => (s.set_type === "warmup" ? "W" : String(++working)));
}

//Line each set up with the same set from last time: 1st warmup with 1st warmup, 2nd working with 2nd working.
//Matching within a type means adding an extra warmup doesn't shift every working row.
function pairWithPrevious(sets: types.WorkoutSet[], previous: types.PreviousSet[]) {
	const seen: Record<string, number> = {};
	return sets.map((s) => {
		const n = seen[s.set_type] ?? 0;
		seen[s.set_type] = n + 1;
		return previous.filter((p) => p.set_type === s.set_type)[n] ?? null;
	});
}

// ---------------- Fetching ----------------

function useWorkout(workout_id: string | undefined, mode: types.WorkoutMode) {
	const shouldFetch = mode !== "new" && !!workout_id; // "new" mode: nothing to fetch (new workouts open with workout_id "new")

	const [workout, setWorkout] = useState<types.WorkoutData>(makeEmptyWorkout); //the function itself: React calls it once, on the first render
	const [loading, setLoading] = useState(shouldFetch);
	//the load failed. The screen shows an error + retry instead of the editor, so an empty placeholder workout
	//can never be saved over the real one (editing deletes any exercises/sets missing from what we send)
	const [error, setError] = useState(false);
	const [attempt, setAttempt] = useState(0); //bumped by retry() so the effect runs again

	useEffect(() => {
		if (!shouldFetch) return;

		let cancelled = false;

		const load = async () => {
			try {
				const resp = await instance.get(`/workouts/${workout_id}`);
				const found: types.WorkoutData = resp.data.workout;
				if (!cancelled) setWorkout(found);
			} catch (err) {
				log.error("Couldn't get workout", err);
				if (!cancelled) setError(true);
			} finally {
				if (!cancelled) setLoading(false);
			}
		};

		load();
		return () => {
			cancelled = true; // screen closed before the request finished: ignore the response
		};
	}, [workout_id, mode, shouldFetch, attempt]);

	const retry = () => {
		setError(false);
		setLoading(true);
		setAttempt((a) => a + 1);
	};

	return { workout, setWorkout, loading, error, retry };
}

//Best weight + last session's sets for each exercise, keyed by catalog_id.
//Only fetches ids it doesn't have yet: everything on load, then just the new one when an exercise is added.
//Reordering/adding sets/typing never refetches since the ids on screen don't change.
function useExerciseStats(catalogIds: number[], excludeWorkoutId?: number) {
	const [stats, setStats] = useState<Record<number, types.ExerciseStats>>({});
	//failed requests so far. Bumping it changes a dependency, which is what makes the effect run again -
	//otherwise a failure leaves missingKey the same and nothing would ever retry
	const [failures, setFailures] = useState(0);

	//a string so the effect only re-runs when the actual missing ids change (a new array every render would re-run it every time)
	const missingKey = catalogIds.filter((id) => !(id in stats)).join(",");

	useEffect(() => {
		if (!missingKey) return;

		let cancelled = false;
		let retryTimer: ReturnType<typeof setTimeout> | undefined;

		instance
			.get("/workouts/exercise-stats", { params: { catalog_ids: missingKey, exclude_workout_id: excludeWorkoutId } })
			.then((resp) => {
				if (!cancelled) setStats((prev) => ({ ...prev, ...resp.data.stats }));
			})
			.catch((err) => {
				log.error("Couldn't get exercise stats", err);
				//try again in a few seconds, up to 3 times (prev/best are nice to have, not worth hammering the server for)
				if (!cancelled && failures < 3) retryTimer = setTimeout(() => setFailures((f) => f + 1), 3000);
			});

		return () => {
			cancelled = true;
			clearTimeout(retryTimer); //left the screen (or the ids changed): drop any pending retry
		};
	}, [missingKey, excludeWorkoutId, failures]);

	return stats;
}

// ---------------- Sets ----------------

//column widths shared by the header row and every set row so they line up
const COL = { grip: 24, type: 56, lbs: 60, reps: 52, rir: 48, trash: 28 };

//A number text box
function NumberField({
	value,
	onChangeValue,
	placeholder,
	decimal = false,
	style,
}: {
	value: number | null;
	onChangeValue: (n: number | null) => void;
	placeholder?: string;
	decimal?: boolean;
	style?: StyleProp<TextStyle>;
}) {
	const { theme } = useTheme();
	const [text, setText] = useState(value == null ? "" : String(value));

	const handleChange = (raw: string) => {
		//digits only, plus a single "." for weights
		const cleaned = decimal ? raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1") : raw.replace(/[^0-9]/g, "");
		setText(cleaned);
		onChangeValue(cleaned === "" || cleaned === "." ? null : Number(cleaned));
	};

	return (
		<TextInput
			style={style}
			value={text}
			onChangeText={handleChange}
			placeholder={placeholder}
			placeholderTextColor={theme.inputPlaceholder}
			keyboardType={decimal ? "decimal-pad" : "number-pad"}
			selectTextOnFocus
		/>
	);
}

const SET_TYPE_OPTIONS: { type: types.SetType; label: string }[] = [
	{ type: "warmup", label: "Warmup" },
	{ type: "working", label: "Working set" },
];

//The "W ⌄" pill. Tapping it slides a "Set type" sheet up from the bottom of the screen.
function SetTypePicker({ label, value, onChange }: { label: string; value: types.SetType; onChange: (type: types.SetType) => void }) {
	const { theme } = useTheme();
	const styles = useMemoStyles(theme);

	const [open, setOpen] = useState(false);

	const pick = (type: types.SetType) => {
		setOpen(false);
		if (type !== value) onChange(type);
	};

	return (
		<>
			<Pressable style={styles.typePill} onPress={() => setOpen(true)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Set type: ${value}`}>
				<Text style={styles.typePillText}>{label}</Text>
				<Ionicons name="chevron-down" size={11} color={theme.primary} />
			</Pressable>

			<Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
				{/* dark full-screen layer: tapping it (anywhere above the sheet) closes the sheet */}
				<Pressable style={styles.sheetOverlay} onPress={() => setOpen(false)}>
					<View style={styles.sheet}>
						<Text style={styles.sheetTitle}>Set type</Text>
						{SET_TYPE_OPTIONS.map((option) => (
							<Pressable key={option.type} style={styles.sheetOption} onPress={() => pick(option.type)}>
								<Text style={styles.sheetOptionText}>{option.label}</Text>
								{option.type === value && <Ionicons name="checkmark" size={18} color={theme.primary} />}
							</Pressable>
						))}
					</View>
				</Pressable>
			</Modal>
		</>
	);
}

//Touch-and-drag handle. Drags whichever reorderable list cell it sits in (a set row, or a whole exercise card).
//Only render it inside a ReorderableList cell: the hook throws anywhere else.
function DragGrip({ label }: { label: string }) {
	const { theme } = useTheme();
	const drag = useReorderableDrag();

	return (
		<Pressable onPressIn={drag} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}>
			<MaterialIcons name="drag-indicator" size={20} color={theme.textTertiary} />
		</Pressable>
	);
}

//One row of the sets table
function SetRow({
	set,
	label,
	previous,
	onChange,
	onRemove,
}: {
	set: types.WorkoutSet;
	label: string; // "W", "1", "2"...
	previous: types.PreviousSet | null; // the matching set from last time, if any
	onChange: (patch: Partial<types.WorkoutSet>) => void;
	onRemove: () => void;
}) {
	const { theme } = useTheme();
	const styles = useMemoStyles(theme);

	return (
		<View style={styles.setRow}>
			<View style={{ width: COL.grip }}>
				<DragGrip label={`Drag set ${label} to reorder`} />
			</View>

			<View style={[styles.typeCell, { width: COL.type }]}>
				<SetTypePicker label={label} value={set.set_type} onChange={(set_type) => onChange({ set_type })} />
			</View>

			<Text style={[styles.prevText, { flex: 1 }]} numberOfLines={1}>
				{previous ? `${formatNumber(previous.weight)} × ${formatNumber(previous.reps)}` : "–"}
			</Text>

			{/* text boxes with last time's numbers as placeholders */}
			<View style={{ width: COL.lbs }}>
				<NumberField value={set.weight} onChangeValue={(weight) => onChange({ weight })} placeholder={previous?.weight?.toString()} decimal style={styles.input} />
			</View>
			<View style={{ width: COL.reps }}>
				<NumberField value={set.reps} onChangeValue={(reps) => onChange({ reps })} placeholder={previous?.reps?.toString()} style={styles.input} />
			</View>
			<View style={{ width: COL.rir }}>
				<NumberField
					value={set.reps_in_reserve}
					onChangeValue={(reps_in_reserve) => onChange({ reps_in_reserve })}
					placeholder={previous?.reps_in_reserve?.toString()}
					style={[styles.input, styles.rirInput]}
				/>
			</View>

			<View style={{ width: COL.trash, alignItems: "center" }}>
				<Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove set ${label}`}>
					<Ionicons name="trash-outline" size={18} color={theme.textTertiary} />
				</Pressable>
			</View>
		</View>
	);
}

//Takes in an exercise and shows its sets: draggable rows with the working/warmup dropdown
function RenderSets({
	exercise,
	previousSets = [],
	onChangeSet,
	onReorderSets,
	onDeleteSet,
}: {
	exercise: types.WorkoutExercise;
	previousSets?: types.PreviousSet[];
	onChangeSet: (setKey: string, patch: Partial<types.WorkoutSet>) => void;
	onReorderSets: (event: ReorderableListReorderEvent) => void;
	onDeleteSet: (setKey: string) => void;
}) {
	const { theme } = useTheme();
	const styles = useMemoStyles(theme);

	if (exercise.sets.length === 0) return <Text style={styles.emptyText}>No sets yet. Add one below.</Text>;

	const labels = setLabels(exercise.sets);
	const paired = pairWithPrevious(exercise.sets, previousSets);

	return (
		<View>
			<View style={styles.setHeader}>
				<View style={{ width: COL.grip }} />
				<Text style={[styles.headerText, { width: COL.type }]}>Type</Text>
				<Text style={[styles.headerText, { flex: 1 }]}>Prev</Text>
				<Text style={[styles.headerText, styles.headerCenter, { width: COL.lbs }]}>Lbs</Text>
				<Text style={[styles.headerText, styles.headerCenter, { width: COL.reps }]}>Reps</Text>
				<Text style={[styles.headerText, styles.headerCenter, { width: COL.rir }]}>RIR</Text>
				<View style={{ width: COL.trash }} />
			</View>

			{/* drag a row by its grip; labels/prev follow the new array order automatically */}
			<ReorderableList
				data={exercise.sets}
				keyExtractor={setKey}
				onReorder={onReorderSets}
				scrollEnabled={false} //grows to fit its rows; the exercise list does the scrolling
				keyboardShouldPersistTaps="handled"
				renderItem={({ item, index }) => (
					<View style={styles.setRowGap}>
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

// ---------------- Exercise card ----------------

function ExerciseCard({
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
	exercise: types.WorkoutExercise;
	index: number;
	total: number;
	stats?: types.ExerciseStats;
	onChangeSet: (setKey: string, patch: Partial<types.WorkoutSet>) => void;
	onReorderSets: (event: ReorderableListReorderEvent) => void;
	onAddSet: () => void;
	onRemove: () => void;
	onDeleteSet: (setKey: string) => void;
}) {
	const { theme } = useTheme();
	const styles = useMemoStyles(theme);
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

	return (
		<View style={styles.card}>
			<View style={styles.cardHeader}>
				<View style={{ flex: 1 }}>
					<Text style={styles.cardEyebrow}>
						Exercise {index + 1} of {total}
						{stats?.best_weight != null && <Text style={styles.cardBest}>{`  ·  Best: ${formatNumber(stats.best_weight)} lbs`}</Text>}
					</Text>
					<Text style={styles.exerciseName}>{name}</Text>
				</View>
				<View style={styles.cardActions}>
					<Pressable onPress={confirmRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${name}`}>
						<Ionicons name="trash-outline" size={18} color={theme.textTertiary} />
					</Pressable>
					{/* sits outside the sets list, so it drags the whole card rather than a set */}
					<DragGrip label={`Drag ${name} to reorder`} />
				</View>
			</View>

			<RenderSets
				exercise={exercise}
				previousSets={stats?.previous_sets}
				onChangeSet={onChangeSet}
				onReorderSets={onReorderSets}
				onDeleteSet={onDeleteSet}
			/>

			<Pressable style={styles.addSetButton} onPress={onAddSet} accessibilityRole="button">
				<Ionicons name="add" size={18} color={theme.textSecondary} />
				<Text style={styles.addSetText}>Add set</Text>
			</Pressable>
		</View>
	);
}

// ---------------- Screen ----------------

//space between exercise cards: the reorderable list measures its cells, so it can't use a gap
const ExerciseGap = () => <View style={{ height: 14 }} />;

//new / edit
function EditWorkout({
	workout,
	setWorkout,
	workoutId,
}: {
	workout: types.WorkoutData;
	setWorkout: Dispatch<SetStateAction<types.WorkoutData>>;
	workoutId?: number; // only when editing a saved workout, so its own sets don't show up as "prev"
}) {
	const { theme } = useTheme();
	const styles = useMemoStyles(theme);

	const catalogIds = workout.exercises.map((e) => e.catalog_id).filter((id): id is number => id != null);
	const stats = useExerciseStats(catalogIds, workoutId);

	const [pickerOpen, setPickerOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [celebrating, setCelebrating] = useState(false);

	//change one set in one exercise, leave everything else alone
	const updateSet = (exKey: string, sKey: string, patch: Partial<types.WorkoutSet>) =>
		setWorkout((w) => ({
			...w,
			exercises: w.exercises.map((e) => (exerciseKey(e) !== exKey ? e : { ...e, sets: e.sets.map((s) => (setKey(s) === sKey ? { ...s, ...patch } : s)) })),
		}));

	const addSet = (exKey: string) =>
		setWorkout((w) => ({
			...w,
			exercises: w.exercises.map((e) =>
				exerciseKey(e) !== exKey
					? e
					: {
							...e,
							sets: [
								...e.sets,
								{ tempId: randomUUID(), order_number: e.sets.length + 1, set_type: "working", notes: "", weight: null, reps: null, reps_in_reserve: null },
							],
						},
			),
		}));

	//new exercises go on the end with one empty working set ready to fill in
	const addExercise = (picked: types.CatalogExercise) => {
		haptics.tap();
		setWorkout((w) => ({
			...w,
			exercises: [
				...w.exercises,
				{
					tempId: randomUUID(),
					catalog_id: picked.catalog_id,
					exercise_name: picked.name,
					notes: "",
					order_number: w.exercises.length + 1,
					sets: [{ tempId: randomUUID(), order_number: 1, set_type: "working", notes: "", weight: null, reps: null, reps_in_reserve: null }],
				},
			],
		}));
	};

	//renumber closes the gap so the remaining sets stay 1..n
	const deleteSet = (exKey: string, sKey: string) =>
		setWorkout((w) => ({
			...w,
			exercises: w.exercises.map((e) => (exerciseKey(e) !== exKey ? e : { ...e, sets: renumber(e.sets.filter((s) => setKey(s) !== sKey)) })),
		}));

	const removeExercise = (exKey: string) => setWorkout((w) => ({ ...w, exercises: renumber(w.exercises.filter((e) => exerciseKey(e) !== exKey)) }));

	//drag-and-drop: move the item, then renumber so order_number always matches what's on screen
	const reorderExercises = ({ from, to }: ReorderableListReorderEvent) =>
		setWorkout((w) => ({ ...w, exercises: renumber(reorderItems(w.exercises, from, to)) }));

	const reorderSets = (exKey: string, { from, to }: ReorderableListReorderEvent) =>
		setWorkout((w) => ({
			...w,
			exercises: w.exercises.map((e) => (exerciseKey(e) !== exKey ? e : { ...e, sets: renumber(reorderItems(e.sets, from, to)) })),
		}));

	const isEditing = workoutId != null; //saved workout: PUT over it. Otherwise (new) POST a new one

	const save = async () => {
		if (saving) return;

		//the backend rejects these anyway; catching them here gives a useful message instead of a failed request
		if (!workout.workout_name.trim()) return toast.error("Give your workout a name.");
		if (workout.exercises.length === 0) return toast.error("Add at least one exercise.");

		//finishing a new workout stamps it finished now. Finished workouts are what "prev"/"best" read from,
		//so an unfinished one would never show up there. Editing keeps the original time.
		const payload = { ...workout, finished_at: workout.finished_at ?? new Date().toISOString() };

		setSaving(true);
		try {
			if (isEditing) await instance.put(`/workouts/${workoutId}`, payload);
			else await instance.post("/workouts", payload);
			haptics.success();

			if (isEditing) {
				toast.success("Workout saved.");
				router.back();
			} else {
				setCelebrating(true); //goes back when it's dismissed
			}
		} catch (err) {
			log.error("Couldn't save workout", err);
			toast.error("Workout not saved. Check your connection and try again.");
			setSaving(false);
		}
	};

	return (
		<Screen>
			<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
				{/* the exercise list IS the screen's scroller (a FlatList), so the set lists inside it are FlatList-in-FlatList,
				    which RN allows. Putting them in a ScrollView instead triggers the "VirtualizedLists should never be nested" error */}
				<ReorderableList
					data={workout.exercises}
					keyExtractor={exerciseKey}
					onReorder={reorderExercises}
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
										onChangeText={(workout_name) => setWorkout((w) => ({ ...w, workout_name }))}
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
							<Pressable style={[styles.saveButton, saving && styles.disabled]} onPress={save} disabled={saving} accessibilityRole="button">
								{saving ? (
									<ActivityIndicator color={theme.textInverse} />
								) : (
									<Text style={styles.saveButtonText}>{isEditing ? "Save changes" : "Finish workout"}</Text>
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
								onChangeSet={(sKey, patch) => updateSet(exKey, sKey, patch)}
								onReorderSets={(event) => reorderSets(exKey, event)}
								onAddSet={() => addSet(exKey)}
								onRemove={() => removeExercise(exKey)}
								onDeleteSet={(sKey) => deleteSet(exKey, sKey)}
							/>
						);
					}}
				/>
			</KeyboardAvoidingView>

			<ExercisePicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addExercise} />

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
		mode?: types.WorkoutMode;
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

function createStyles(theme: Theme) {
	return StyleSheet.create({
		safeArea: { flex: 1, backgroundColor: theme.background },
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
		title: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 34, color: theme.text },
		titleInput: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 34, color: theme.text, padding: 0 },
		subtitle: { fontSize: 14, color: theme.textMuted },
		timerRow: { flex: 1, flexDirection: "row", gap: 2 },
		emptyText: { fontSize: 14, color: theme.textMuted, paddingVertical: 8 },

		// Exercise card
		card: { backgroundColor: theme.cardBg, borderRadius: 18, borderWidth: 1, borderColor: theme.border, padding: 16 },
		cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
		cardActions: { flexDirection: "row", alignItems: "center", gap: 14 },
		cardEyebrow: { fontSize: 13, fontWeight: "600", color: theme.primary },
		cardBest: { fontSize: 13, fontWeight: "500", color: theme.textMuted },
		exerciseName: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 30, color: theme.text, marginBottom: 12 },

		// Sets table
		setHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, marginBottom: 8 },
		headerText: { fontSize: 12, fontWeight: "600", color: theme.textMuted },
		headerCenter: { textAlign: "center" },
		setRowGap: { paddingBottom: 8 },
		setRow: {
			flexDirection: "row",
			alignItems: "center",
			minHeight: 48,
			paddingHorizontal: 8,
			borderRadius: 14,
			borderWidth: 1,
			borderColor: theme.borderLight,
			backgroundColor: theme.cardBg,
		},
		typeCell: { flexDirection: "row", alignItems: "center", gap: 6 },
		typePill: {
			flexDirection: "row",
			alignItems: "center",
			gap: 2,
			paddingHorizontal: 8,
			paddingVertical: 4,
			borderRadius: 8,
			backgroundColor: theme.cardBgAlt,
			borderWidth: 1,
			borderColor: theme.border,
		},
		typePillText: { fontSize: 13, fontWeight: "700", color: theme.primary },
		prevText: { fontSize: 14, color: theme.textMuted },
		input: {
			marginHorizontal: 3,
			height: 34,
			borderRadius: 8,
			borderWidth: 1,
			borderColor: theme.inputBorder,
			backgroundColor: theme.inputBg,
			color: theme.text,
			fontSize: 15,
			fontWeight: "700",
			textAlign: "center",
			paddingVertical: 0,
		},
		rirInput: { borderColor: theme.primary, color: theme.primary },

		// Card button
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

		// Set type picker (bottom sheet)
		sheetOverlay: { flex: 1, backgroundColor: theme.overlay, justifyContent: "flex-end" },
		sheet: { backgroundColor: theme.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32, gap: 4 },
		sheetTitle: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 28, color: theme.text, marginBottom: 4 },
		sheetOption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
		sheetOptionText: { fontSize: 16, color: theme.text },
	});
}

function useMemoStyles(theme: Theme) {
	return useMemo(() => createStyles(theme), [theme]);
}
