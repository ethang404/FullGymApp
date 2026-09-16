import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { PressableScale } from "@/components/PressableScale";
import type { Task, TaskFrequency } from "@/app/(protected)/types/tasks";

const STORAGE_KEY = "@tasks";

const FREQUENCIES: TaskFrequency[] = ["hourly", "daily", "weekly"];

const FREQUENCY_LABELS: Record<TaskFrequency, string> = {
	hourly: "Hourly",
	daily: "Daily",
	weekly: "Weekly",
};

// How long a completed task stays checked off before it resets to pending.
const FREQUENCY_MS: Record<TaskFrequency, number> = {
	hourly: 60 * 60 * 1000,
	daily: 24 * 60 * 60 * 1000,
	weekly: 7 * 24 * 60 * 60 * 1000,
};

const defaultTasks: Task[] = [
	{
		id: randomUUID(),
		title: "Take Creatine",
		frequency: "daily",
		done: false,
		completedAt: null,
	},
	{
		id: randomUUID(),
		title: "Drink 32oz + water",
		frequency: "daily",
		done: false,
		completedAt: null,
	},
];

// Un-checks any task whose completion window has elapsed. Returns the same
// array reference when nothing changed, so callers can skip a re-render/save.
function resetExpiredTasks(tasks: Task[]): Task[] {
	const now = Date.now();
	let changed = false;

	const next = tasks.map((task) => {
		if (!task.done || !task.completedAt) return task;
		const elapsed = now - new Date(task.completedAt).getTime();
		if (elapsed < FREQUENCY_MS[task.frequency]) return task;
		changed = true;
		return { ...task, done: false, completedAt: null };
	});

	return changed ? next : tasks;
}

export function Tasks() {
	const { theme } = useTheme();
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [newTitle, setNewTitle] = useState("");
	const [newFrequency, setNewFrequency] = useState<TaskFrequency>("daily");

	// Load persisted tasks on mount, clearing out any that expired while we were away.
	useEffect(() => {
		(async () => {
			try {
				const raw = await AsyncStorage.getItem(STORAGE_KEY);
				const stored: Task[] = raw ? JSON.parse(raw) : defaultTasks;
				setTasks(resetExpiredTasks(stored));
			} finally {
				setLoaded(true);
			}
		})();
	}, []);

	// Persist on every change, once the initial load has happened.
	useEffect(() => {
		if (!loaded) return;
		AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)).catch(() => {});
	}, [tasks, loaded]);

	// Periodically sweep for tasks whose recurrence window has elapsed so the
	// checkbox flips back on its own instead of only refreshing on remount.
	useEffect(() => {
		const interval = setInterval(() => {
			setTasks((prev) => resetExpiredTasks(prev));
		}, 30_000);
		return () => clearInterval(interval);
	}, []);

	const addTask = useCallback(() => {
		const title = newTitle.trim();
		if (!title) return;
		const task: Task = {
			id: randomUUID(),
			title,
			frequency: newFrequency,
			done: false,
			completedAt: null,
		};
		setTasks((prev) => [...prev, task]);
		setNewTitle("");
	}, [newTitle, newFrequency]);

	const removeTask = useCallback((id: string) => {
		setTasks((prev) => prev.filter((t) => t.id !== id));
	}, []);

	const toggleTask = useCallback((id: string) => {
		setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done, completedAt: !t.done ? new Date().toISOString() : null } : t)));
	}, []);

	const styles = useMemo(
		() =>
			StyleSheet.create({
				sectionRow: {
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: 12,
				},
				sectionTitle: {
					fontSize: 17,
					fontWeight: "700",
					color: theme.text,
				},
				card: {
					backgroundColor: theme.cardBg,
					borderRadius: 16,
					padding: 18,
					borderWidth: 1,
					borderColor: theme.border,
				},
				emptyText: {
					fontSize: 14,
					color: theme.textMuted,
					textAlign: "center",
					paddingVertical: 16,
				},
				row: {
					flexDirection: "row",
					alignItems: "center",
					paddingVertical: 12,
					borderBottomWidth: 1,
					borderBottomColor: theme.border,
					gap: 12,
				},
				lastRow: {
					borderBottomWidth: 0,
				},
				checkbox: {
					width: 26,
					height: 26,
					borderRadius: 13,
					borderWidth: 2,
					borderColor: theme.primary,
					alignItems: "center",
					justifyContent: "center",
				},
				checkboxDone: {
					backgroundColor: theme.primary,
				},
				rowTitle: {
					fontSize: 15,
					fontWeight: "600",
					color: theme.text,
				},
				rowTitleDone: {
					color: theme.textMuted,
					textDecorationLine: "line-through",
				},
				rowMeta: {
					fontSize: 12,
					color: theme.textMuted,
					marginTop: 2,
				},
				trashButton: {
					padding: 6,
				},

				// Add-task form
				addRow: {
					flexDirection: "row",
					alignItems: "center",
					gap: 10,
					marginTop: 14,
				},
				input: {
					flex: 1,
					backgroundColor: theme.inputBg,
					borderWidth: 1,
					borderColor: theme.inputBorder,
					borderRadius: 12,
					paddingHorizontal: 14,
					paddingVertical: 10,
					fontSize: 14,
					color: theme.text,
				},
				addButton: {
					width: 40,
					height: 40,
					borderRadius: 12,
					backgroundColor: theme.primary,
					alignItems: "center",
					justifyContent: "center",
				},
				freqRow: {
					flexDirection: "row",
					gap: 8,
					marginTop: 10,
				},
				freqPill: {
					paddingHorizontal: 12,
					paddingVertical: 6,
					borderRadius: 999,
					borderWidth: 1,
					borderColor: theme.border,
					backgroundColor: theme.cardBgAlt,
				},
				freqPillActive: {
					backgroundColor: theme.primary,
					borderColor: theme.primary,
				},
				freqPillText: {
					fontSize: 12,
					fontWeight: "700",
					color: theme.textMuted,
				},
				freqPillTextActive: {
					color: theme.textInverse,
				},
			}),
		[theme],
	);

	return (
		<View>
			<View style={styles.sectionRow}>
				<Text style={styles.sectionTitle}>Tasks</Text>
			</View>

			<View style={styles.card}>
				{tasks.length === 0 ? (
					<Text style={styles.emptyText}>No tasks yet. Add one below.</Text>
				) : (
					tasks.map((task, i) => (
						<View key={task.id} style={[styles.row, i === tasks.length - 1 && styles.lastRow]}>
							<PressableScale style={[styles.checkbox, task.done && styles.checkboxDone]} onPress={() => toggleTask(task.id)}>
								{task.done && <FontAwesome5 name="check" size={12} color={theme.textInverse} />}
							</PressableScale>
							<View style={{ flex: 1 }}>
								<Text style={[styles.rowTitle, task.done && styles.rowTitleDone]}>{task.title}</Text>
								<Text style={styles.rowMeta}>{FREQUENCY_LABELS[task.frequency]}</Text>
							</View>
							<TouchableOpacity style={styles.trashButton} onPress={() => removeTask(task.id)}>
								<FontAwesome5 name="trash-alt" size={14} color={theme.textTertiary} />
							</TouchableOpacity>
						</View>
					))
				)}

				<View style={styles.addRow}>
					<TextInput
						style={styles.input}
						placeholder="Add a task..."
						placeholderTextColor={theme.inputPlaceholder}
						value={newTitle}
						onChangeText={setNewTitle}
						onSubmitEditing={addTask}
						returnKeyType="done"
					/>
					<PressableScale style={styles.addButton} onPress={addTask}>
						<FontAwesome5 name="plus" size={14} color={theme.textInverse} />
					</PressableScale>
				</View>

				<View style={styles.freqRow}>
					{FREQUENCIES.map((freq) => (
						<TouchableOpacity key={freq} style={[styles.freqPill, newFrequency === freq && styles.freqPillActive]} onPress={() => setNewFrequency(freq)}>
							<Text style={[styles.freqPillText, newFrequency === freq && styles.freqPillTextActive]}>{FREQUENCY_LABELS[freq]}</Text>
						</TouchableOpacity>
					))}
				</View>
			</View>
		</View>
	);
}
