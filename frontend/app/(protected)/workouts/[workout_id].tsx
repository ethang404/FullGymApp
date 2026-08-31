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
	FlatList,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useCallback, useMemo } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Ionicons from "@expo/vector-icons/Ionicons";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { randomUUID } from "expo-crypto";
import ReorderableList, { reorderItems, useReorderableDrag, ReorderableListReorderEvent } from "react-native-reorderable-list";

import { useTheme } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/colors";
import { instance } from "@/utils/AxiosInterceptorHandler";
import * as types from "../types/workouts";

const emptyWorkout: types.WorkoutData = {
	workout_name: "",
	workout_date: new Date().toISOString(),
	notes: "",
	finished_at: null,
	exercises: [],
};

interface exercise {
	catalog_id: Number;
	name: string;
	muscle_group: string;
}

// ---- Key helpers: fall back to tempId for unsaved items ----
const getExerciseKey = (ex: types.WorkoutExercise) => ex.exercise_id?.toString() ?? ex.tempId!;
const getSetKey = (s: types.WorkoutSet) => s.set_id?.toString() ?? s.tempId!;

// ---- Reassign order_number to match array position after any drag ----
function withRecomputedOrder<T extends { order_number: number }>(items: T[]): T[] {
	return items.map((item, index) => ({ ...item, order_number: index + 1 }));
}

export default function Workout() {
	const { workout_id, mode } = useLocalSearchParams<{
		workout_id?: string;
		mode: "new" | "edit" | "copy";
	}>();

	const { theme } = useTheme();
	const styles = useMemoStyles(theme);

	const [workout, setWorkout] = useState<types.WorkoutData>(emptyWorkout);
	const [loading, setLoading] = useState(mode === "edit" || mode === "copy");
	const [saving, setSaving] = useState(false);

	const [availExercises, setAvailExercises] = useState<exercise[]>([]);
	const [activeExerciseKey, setActiveExerciseKey] = useState<string | null>(null);

	useEffect(() => {
		const getAllExercises = async () => {
			try {
				const resp = await instance.get(`/workouts/catalog/`);
				setAvailExercises(resp.data.exercises);
			} catch (err) {
				console.error(err);
			} finally {
				setLoading(false);
			}
		};

		getAllExercises();
	}, []);

	useEffect(() => {
		if ((mode === "edit" || mode === "copy") && workout_id != null) {
			const getWorkoutData = async () => {
				setLoading(true);
				try {
					const resp = await instance.get(`/workouts/${workout_id}`);
					const found = resp.data.workout;

					if (!found) {
						console.warn(`No workout found for id ${workout_id}`);
						setWorkout(emptyWorkout);
						return;
					}

					const exercises = found.exercises.map((ex: any) => ({
						...ex,
						exercise_id: mode === "copy" ? undefined : ex.exercise_id,
						tempId: mode === "copy" || ex.exercise_id == null ? randomUUID() : undefined,
						sets: ex.sets.map((s: any) => ({
							...s,
							set_id: mode === "copy" ? undefined : s.set_id,
							tempId: mode === "copy" || s.set_id == null ? randomUUID() : undefined,
						})),
					}));

					setWorkout({
						workout_name: found.name,
						workout_date: found.workout_date,
						notes: found.notes ?? "",
						finished_at: found.finished_at ?? null,
						exercises,
					});
				} catch (err) {
					console.error(err);
				} finally {
					setLoading(false);
				}
			};

			getWorkoutData();
		} else if (mode == "new") {
			setWorkout(emptyWorkout);
			setLoading(false);
		}
	}, [workout_id, mode]);

	// ---------------- Reorder handlers (local state only) ----------------

	const handleExerciseReorder = useCallback(({ from, to }: ReorderableListReorderEvent) => {
		setWorkout((prev) => ({
			...prev,
			exercises: withRecomputedOrder(reorderItems(prev.exercises, from, to)),
		}));
	}, []);

	const handleSetReorder = useCallback((exerciseKey: string, { from, to }: ReorderableListReorderEvent) => {
		setWorkout((prev) => ({
			...prev,
			exercises: prev.exercises.map((ex) => (getExerciseKey(ex) === exerciseKey ? { ...ex, sets: withRecomputedOrder(reorderItems(ex.sets, from, to)) } : ex)),
		}));
	}, []);

	// ---------------- Add / edit / delete helpers ----------------

	const addExercise = useCallback(() => {
		const newTempId = randomUUID();
		setWorkout((prev) => ({
			...prev,
			exercises: [
				...prev.exercises,
				{
					tempId: newTempId,
					exercise_name: "",
					notes: "",
					order_number: prev.exercises.length + 1,
					sets: [],
				},
			],
		}));
		setActiveExerciseKey(newTempId);
	}, []);

	const deleteExercise = useCallback((exerciseKey: string) => {
		setWorkout((prev) => ({
			...prev,
			exercises: withRecomputedOrder(prev.exercises.filter((ex) => getExerciseKey(ex) !== exerciseKey)),
		}));
	}, []);

	const updateExercise = useCallback((exerciseKey: string, patch: Partial<types.WorkoutExercise>) => {
		setWorkout((prev) => ({
			...prev,
			exercises: prev.exercises.map((ex) => (getExerciseKey(ex) === exerciseKey ? { ...ex, ...patch } : ex)),
		}));
	}, []);

	const addSet = useCallback((exerciseKey: string) => {
		setWorkout((prev) => ({
			...prev,
			exercises: prev.exercises.map((ex) =>
				getExerciseKey(ex) === exerciseKey
					? {
							...ex,
							sets: [
								...ex.sets,
								{
									tempId: randomUUID(),
									order_number: ex.sets.length + 1,
									set_type: "working",
									notes: "",
									reps: 0,
									weight: 0,
								},
							],
						}
					: ex,
			),
		}));
	}, []);

	const deleteSet = useCallback((exerciseKey: string, setKey: string) => {
		setWorkout((prev) => ({
			...prev,
			exercises: prev.exercises.map((ex) =>
				getExerciseKey(ex) === exerciseKey ? { ...ex, sets: withRecomputedOrder(ex.sets.filter((s) => getSetKey(s) !== setKey)) } : ex,
			),
		}));
	}, []);

	const updateSet = useCallback((exerciseKey: string, setKey: string, patch: Partial<types.WorkoutSet>) => {
		setWorkout((prev) => ({
			...prev,
			exercises: prev.exercises.map((ex) =>
				getExerciseKey(ex) === exerciseKey ? { ...ex, sets: ex.sets.map((s) => (getSetKey(s) === setKey ? { ...s, ...patch } : s)) } : ex,
			),
		}));
	}, []);

	const handleCreateNewCatalogExercise = async (name: string, muscleGroup: string) => {
		try {
			const resp = await instance.post(`/workouts/catalog/`, { name, muscle_group: muscleGroup });
			const created: exercise = resp.data.exercise;

			setAvailExercises((prev) => [...prev, created]);

			if (activeExerciseKey) {
				updateExercise(activeExerciseKey, {
					exercise_name: created.name,
					catalog_id: Number(created.catalog_id),
				});
			}
		} catch (err) {
			console.error("Error creating exercise catalog entry:", err);
		}
	};

	const handleSave = useCallback(async () => {
		//loop through exercises and ensure each one has a catalog_id
		const validExercises = workout.exercises.filter((exercise) => exercise.catalog_id);

		//only pass exercises with valid catalog_ids to backend
		const payload = {
			...workout,
			exercises: validExercises,
		};

		setSaving(true);
		try {
			if (mode === "edit" && workout_id != null) {
				await instance.put(`/workouts/${workout_id}`, payload);
			} else {
				await instance.post(`/workouts`, payload);
			}
		} catch (err) {
			console.error(err);
		} finally {
			setSaving(false);
		}
	}, [mode, workout_id, workout]);

	const ListHeader = useCallback(
		() => (
			<TextInput
				style={styles.titleInput}
				value={workout.workout_name}
				onChangeText={(text) => setWorkout((prev) => ({ ...prev, workout_name: text }))}
				placeholder="Workout name"
				placeholderTextColor={theme.text + "88"}
			/>
		),
		[workout.workout_name, styles, theme],
	);

	const ListFooter = useCallback(
		() => (
			<>
				<Pressable style={styles.addButton} onPress={addExercise}>
					<Ionicons name="add-circle-outline" size={20} color={theme.text} />
					<Text style={styles.addButtonText}>Add Exercise</Text>
				</Pressable>

				<Pressable style={[styles.saveButton, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
					{saving ? <ActivityIndicator color={theme.textInverse} /> : <Text style={styles.saveButtonText}>Save Workout</Text>}
				</Pressable>
			</>
		),
		[addExercise, handleSave, saving, styles, theme],
	);

	if (loading) {
		return (
			<SafeAreaView style={[styles.safeArea, styles.centered]}>
				<View style={styles.headerRow}>
					<TouchableOpacity style={styles.iconButton} onPress={() => router.back()} hitSlop={10}>
						<FontAwesome5 name="chevron-left" size={18} color={theme.text} />
					</TouchableOpacity>
				</View>
				<ActivityIndicator size="large" color={theme.primary} />
			</SafeAreaView>
		);
	}

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.headerRow}>
					<TouchableOpacity style={styles.iconButton} onPress={() => router.back()} hitSlop={10}>
						<FontAwesome5 name="chevron-left" size={18} color={theme.text} />
					</TouchableOpacity>
				</View>
				<ReorderableList
					data={workout.exercises}
					onReorder={handleExerciseReorder}
					renderItem={({ item }) => (
						<ExerciseCard
							exercise={item}
							onDelete={() => deleteExercise(getExerciseKey(item))}
							onUpdate={(patch) => updateExercise(getExerciseKey(item), patch)}
							onAddSet={() => addSet(getExerciseKey(item))}
							onSetReorder={(event) => handleSetReorder(getExerciseKey(item), event)}
							onDeleteSet={(setKey) => deleteSet(getExerciseKey(item), setKey)}
							onUpdateSet={(setKey, patch) => updateSet(getExerciseKey(item), setKey, patch)}
							onOpenSelector={() => setActiveExerciseKey(getExerciseKey(item))}
							styles={styles}
							theme={theme}
						/>
					)}
					keyExtractor={getExerciseKey}
					ListHeaderComponent={ListHeader}
					ListFooterComponent={ListFooter}
					contentContainerStyle={{ paddingBottom: 40 }}
				/>

				<ExerciseSelectorModal
					visible={activeExerciseKey !== null}
					onClose={() => setActiveExerciseKey(null)}
					availExercises={availExercises}
					onSelect={(selected) => {
						if (activeExerciseKey) {
							updateExercise(activeExerciseKey, {
								exercise_name: selected.name,
								catalog_id: Number(selected.catalog_id),
							});
						}
					}}
					onAddNew={handleCreateNewCatalogExercise}
					theme={theme}
					styles={styles}
				/>
			</SafeAreaView>
		</GestureHandlerRootView>
	);
}

function ExerciseCard({
	exercise,
	onDelete,
	onUpdate,
	onAddSet,
	onSetReorder,
	onDeleteSet,
	onUpdateSet,
	onOpenSelector,
	styles,
	theme,
}: {
	exercise: types.WorkoutExercise;
	onDelete: () => void;
	onUpdate: (patch: Partial<types.WorkoutExercise>) => void;
	onAddSet: () => void;
	onSetReorder: (event: ReorderableListReorderEvent) => void;
	onDeleteSet: (setKey: string) => void;
	onUpdateSet: (setKey: string, patch: Partial<types.WorkoutSet>) => void;
	onOpenSelector: () => void;
	styles: ReturnType<typeof createStyles>;
	theme: Theme;
}) {
	const drag = useReorderableDrag();

	return (
		<View style={[styles.card, { overflow: "hidden" }]}>
			<View style={styles.cardHeader}>
				<Pressable onLongPress={drag} hitSlop={10}>
					<Ionicons name="reorder-three" size={22} color={theme.text} />
				</Pressable>

				<TouchableOpacity style={{ flex: 1 }} onPress={onOpenSelector}>
					<Text style={[styles.exerciseTitle, !exercise.exercise_name && { color: theme.text + "66" }]}>{exercise.exercise_name || "Select Exercise..."}</Text>
				</TouchableOpacity>

				<Pressable onPress={onDelete} hitSlop={10}>
					<Ionicons name="trash-outline" size={18} color={theme.text} />
				</Pressable>
			</View>

			<TextInput
				style={styles.notesInput}
				value={exercise.notes}
				onChangeText={(text) => onUpdate({ notes: text })}
				placeholder="Exercise notes"
				placeholderTextColor={theme.text + "88"}
			/>

			<ReorderableList
				data={exercise.sets}
				onReorder={onSetReorder}
				renderItem={({ item }) => (
					<SetRow
						set={item}
						onDelete={() => onDeleteSet(getSetKey(item))}
						onUpdate={(patch) => onUpdateSet(getSetKey(item), patch)}
						styles={styles}
						theme={theme}
					/>
				)}
				keyExtractor={getSetKey}
				scrollEnabled={false}
				style={{ overflow: "hidden" }}
			/>

			<Pressable style={styles.addSetButton} onPress={onAddSet}>
				<Ionicons name="add" size={16} color={theme.text} />
				<Text style={styles.addButtonText}>Add Set</Text>
			</Pressable>
		</View>
	);
}

function SetRow({
	set,
	onDelete,
	onUpdate,
	styles,
	theme,
}: {
	set: types.WorkoutSet;
	onDelete: () => void;
	onUpdate: (patch: Partial<types.WorkoutSet>) => void;
	styles: ReturnType<typeof createStyles>;
	theme: Theme;
}) {
	const drag = useReorderableDrag();

	return (
		<View style={[styles.setRow, { overflow: "hidden" }]}>
			<Pressable onLongPress={drag} hitSlop={10}>
				<Ionicons name="reorder-three-outline" size={18} color={theme.text} />
			</Pressable>

			<Text style={styles.setLabel}>Set {set.order_number}</Text>

			<TextInput
				style={styles.numberInput}
				value={String(set.reps)}
				onChangeText={(text) => onUpdate({ reps: Number(text) || 0 })}
				keyboardType="numeric"
				placeholder="reps"
			/>
			<TextInput
				style={styles.numberInput}
				value={String(set.weight)}
				onChangeText={(text) => onUpdate({ weight: Number(text) || 0 })}
				keyboardType="numeric"
				placeholder="wt"
			/>

			<Pressable onPress={onDelete} hitSlop={10}>
				<Ionicons name="close-circle-outline" size={18} color={theme.error} />
			</Pressable>
		</View>
	);
}

function ExerciseSelectorModal({
	visible,
	onClose,
	availExercises,
	onSelect,
	onAddNew,
	theme,
	styles,
}: {
	visible: boolean;
	onClose: () => void;
	availExercises: exercise[];
	onSelect: (selected: exercise) => void;
	onAddNew: (name: string, muscleGroup: string) => void;
	theme: Theme;
	styles: ReturnType<typeof createStyles>;
}) {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedGroup, setSelectedGroup] = useState("all");

	const muscleGroups = useMemo(() => {
		const groups = new Set(availExercises.map((e) => e.muscle_group).filter(Boolean));
		return ["all", ...Array.from(groups)];
	}, [availExercises]);

	const filteredExercises = useMemo(() => {
		return availExercises.filter((item) => {
			const matchesFilter = selectedGroup === "all" || item.muscle_group === selectedGroup;
			const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
			return matchesFilter && matchesSearch;
		});
	}, [availExercises, selectedGroup, searchQuery]);

	const exactMatchExists = useMemo(() => {
		return availExercises.some((e) => e.name.toLowerCase() === searchQuery.trim().toLowerCase());
	}, [availExercises, searchQuery]);

	const handleCreateNew = () => {
		if (searchQuery.trim()) {
			onAddNew(searchQuery.trim(), selectedGroup === "all" ? "Other" : selectedGroup);
			setSearchQuery("");
			onClose();
		}
	};

	return (
		<Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
			<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalContainer}>
				<View style={styles.modalHeader}>
					<Text style={styles.modalTitle}>Select Exercise</Text>
					<TouchableOpacity onPress={onClose} hitSlop={10}>
						<Ionicons name="close" size={24} color={theme.text} />
					</TouchableOpacity>
				</View>

				<TextInput
					style={styles.modalSearchInput}
					placeholder="Search exercise..."
					placeholderTextColor={theme.text + "88"}
					value={searchQuery}
					onChangeText={setSearchQuery}
				/>

				<View style={styles.filterChipContainer}>
					<FlatList
						horizontal
						data={muscleGroups}
						keyExtractor={(item) => item}
						showsHorizontalScrollIndicator={false}
						renderItem={({ item }) => (
							<TouchableOpacity
								style={[styles.filterChip, selectedGroup === item && { backgroundColor: theme.primary }]}
								onPress={() => setSelectedGroup(item)}
							>
								<Text style={[styles.filterChipText, selectedGroup === item && { color: theme.textInverse }]}>{item}</Text>
							</TouchableOpacity>
						)}
					/>
				</View>

				<FlatList
					data={filteredExercises}
					keyExtractor={(item) => item.catalog_id.toString()}
					renderItem={({ item }) => (
						<TouchableOpacity
							style={styles.exerciseListItem}
							onPress={() => {
								onSelect(item);
								onClose();
							}}
						>
							<Text style={styles.exerciseListItemName}>{item.name}</Text>
							<Text style={styles.exerciseListItemSub}>{item.muscle_group}</Text>
						</TouchableOpacity>
					)}
					ListEmptyComponent={() => (
						<View style={styles.emptyContainer}>
							<Text style={{ color: theme.text }}>No exercises found.</Text>
						</View>
					)}
					ListFooterComponent={
						!exactMatchExists && searchQuery.trim().length > 0 ? (
							<TouchableOpacity style={[styles.saveButton, { margin: 16 }]} onPress={handleCreateNew}>
								<Text style={styles.saveButtonText}>Add "{searchQuery.trim()}" to Catalog</Text>
							</TouchableOpacity>
						) : null
					}
				/>
			</KeyboardAvoidingView>
		</Modal>
	);
}

function createStyles(theme: Theme) {
	return StyleSheet.create({
		safeArea: { flex: 1, backgroundColor: theme.background },
		centered: { justifyContent: "center", alignItems: "center" },
		headerRow: {
			flexDirection: "row",
			alignItems: "center",
			paddingHorizontal: 16,
			paddingTop: 8,
		},
		iconButton: {
			padding: 8,
		},
		titleInput: {
			fontSize: 22,
			fontWeight: "600",
			padding: 16,
			color: theme.text,
		},
		card: {
			marginHorizontal: 16,
			marginBottom: 12,
			padding: 12,
			backgroundColor: theme.cardBg,
			borderRadius: 8,
			shadowColor: theme.shadowColor,
			shadowOffset: { width: 0, height: 1 },
			shadowOpacity: 0.2,
			shadowRadius: 1.41,
			elevation: 2,
		},
		cardHeader: {
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
			marginBottom: 8,
		},
		exerciseTitle: { flex: 1, fontSize: 16, fontWeight: "600", color: theme.primary },
		notesInput: { marginBottom: 8, color: theme.text },
		setRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingVertical: 8,
			paddingHorizontal: 4,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: theme.text + "33",
		},
		setLabel: { flex: 1, color: theme.text },
		numberInput: {
			width: 48,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: theme.text + "55",
			borderRadius: 6,
			padding: 4,
			color: theme.text,
			textAlign: "center",
		},
		addButton: {
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
			marginHorizontal: 16,
			marginBottom: 20,
			padding: 10,
		},
		addSetButton: {
			flexDirection: "row",
			alignItems: "center",
			gap: 4,
			marginTop: 6,
			alignSelf: "flex-start",
		},
		addButtonText: { color: theme.text, fontWeight: "500" },
		saveButton: {
			marginHorizontal: 16,
			padding: 14,
			borderRadius: 8,
			backgroundColor: theme.primary,
			alignItems: "center",
		},
		saveButtonText: { color: theme.textInverse, fontWeight: "600", fontSize: 16 },

		modalContainer: { flex: 1, backgroundColor: theme.background, padding: 16 },
		modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
		modalTitle: { fontSize: 18, fontWeight: "600", color: theme.text },
		modalSearchInput: {
			borderWidth: 1,
			borderColor: theme.text + "33",
			borderRadius: 8,
			padding: 10,
			color: theme.text,
			marginBottom: 12,
		},
		filterChipContainer: { marginBottom: 12 },
		filterChip: {
			paddingHorizontal: 12,
			paddingVertical: 6,
			borderRadius: 16,
			backgroundColor: theme.text + "15",
			marginRight: 8,
		},
		filterChipText: { color: theme.text, fontSize: 14, textTransform: "capitalize" },
		exerciseListItem: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.text + "33" },
		exerciseListItemName: { fontSize: 16, fontWeight: "500", color: theme.text },
		exerciseListItemSub: { fontSize: 12, color: theme.text + "88", marginTop: 2 },
		emptyContainer: { padding: 20, alignItems: "center" },
	});
}

function useMemoStyles(theme: Theme) {
	return useMemo(() => createStyles(theme), [theme]);
}
