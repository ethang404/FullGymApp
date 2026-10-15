import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Modal, FlatList, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { isAxiosError } from "axios";

import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/typography";
import type { Theme } from "@/theme/colors";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import Pills from "@/components/Pills";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type CatalogExercise, type MuscleGroup } from "@/types/workouts";

type Filter = MuscleGroup | "all";

//The whole catalog, fetched the first time the picker opens and kept after that (it's a few hundred rows at most,
//so searching/filtering locally is instant and doesn't hit the server per keystroke)
function useCatalog(enabled: boolean) {
	const [exercises, setExercises] = useState<CatalogExercise[] | null>(null);
	const [error, setError] = useState(false);
	const [attempt, setAttempt] = useState(0); //bumped by retry() so the effect runs again

	useEffect(() => {
		if (!enabled || exercises) return;

		let cancelled = false;
		instance
			.get("/workouts/catalog")
			.then((resp) => {
				if (!cancelled) setExercises(resp.data.exercises);
			})
			.catch((err) => {
				log.error("Couldn't load exercise catalog", err);
				if (!cancelled) setError(true);
			});

		return () => {
			cancelled = true;
		};
	}, [enabled, exercises, attempt]);

	const retry = () => {
		setError(false);
		setAttempt((a) => a + 1);
	};

	//a newly created exercise goes straight into the list, so it shows up next time without a refetch
	const add = (exercise: CatalogExercise) => setExercises((prev) => [...(prev ?? []), exercise].sort((a, b) => a.name.localeCompare(b.name)));

	return { exercises, error, retry, add };
}

//Bottom sheet for adding an exercise to a workout: search + muscle group filter over the catalog,
//plus "create" for anything that isn't in it yet
export function ExercisePicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (exercise: CatalogExercise) => void }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const styles = useMemo(() => createStyles(theme, insets.bottom), [theme, insets.bottom]);

	const catalog = useCatalog(visible);

	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<Filter>("all");
	const [newGroup, setNewGroup] = useState<MuscleGroup | null>(null); //muscle group for a brand-new exercise
	const [creating, setCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);

	const query = search.trim();

	const results = useMemo(() => {
		const q = query.toLowerCase();
		return (catalog.exercises ?? []).filter((e) => (filter === "all" || e.muscle_group === filter) && e.name.toLowerCase().includes(q));
	}, [catalog.exercises, filter, query]);

	//only offer "create" when nothing in the catalog already has this exact name (the backend rejects duplicates anyway)
	const canCreate = query.length > 0 && !(catalog.exercises ?? []).some((e) => e.name.toLowerCase() === query.toLowerCase());

	//start fresh each time it closes, so reopening doesn't show the last search
	const close = () => {
		setSearch("");
		setFilter("all");
		setNewGroup(null);
		setCreateError(null);
		onClose();
	};

	const pick = (exercise: CatalogExercise) => {
		onPick(exercise);
		close();
	};

	//a new exercise needs a muscle group: whatever they tapped, else the filter they're browsing (if it's a real group)
	const createGroup = newGroup ?? (filter !== "all" ? filter : null);

	const create = async () => {
		if (!createGroup || creating) return;

		setCreating(true);
		setCreateError(null);
		try {
			const resp = await instance.post("/workouts/catalog", { name: query, muscle_group: createGroup });
			const created: CatalogExercise = resp.data.exercise;
			catalog.add(created);
			pick(created);
		} catch (err) {
			log.error("Couldn't create catalog exercise", err);
			//the backend explains duplicates/missing fields in message; anything else is probably the connection
			const message = isAxiosError(err) ? err.response?.data?.message : null;
			setCreateError(message ?? "Couldn't create that exercise. Check your connection and try again.");
		} finally {
			setCreating(false);
		}
	};

	const createFooter = canCreate ? (
		<View style={styles.createBox}>
			<Text style={styles.createTitle}>{`Create "${query}"`}</Text>
			<Text style={styles.createHint}>Which muscle group does it work?</Text>
			<Pills options={MUSCLE_GROUPS} value={createGroup} onSelect={setNewGroup} labels={MUSCLE_GROUP_LABELS} />
			{createError && <Text style={styles.errorText}>{createError}</Text>}
			<Pressable
				style={[styles.createButton, (!createGroup || creating) && styles.disabled]}
				onPress={create}
				disabled={!createGroup || creating}
				accessibilityRole="button"
			>
				{creating ? <ActivityIndicator color={theme.textInverse} /> : <Text style={styles.createButtonText}>Create and add</Text>}
			</Pressable>
		</View>
	) : null;

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
			<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
				{/* tapping the dimmed area above the sheet closes it */}
				<Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close" />

				<View style={styles.sheet}>
					<View style={styles.headerRow}>
						<Text style={styles.title}>Add exercise</Text>
						<Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
							<Ionicons name="close" size={24} color={theme.primary} />
						</Pressable>
					</View>

					<View style={styles.searchBox}>
						<Ionicons name="search" size={16} color={theme.textTertiary} />
						<TextInput
							style={styles.searchInput}
							value={search}
							onChangeText={setSearch}
							placeholder="Search exercises"
							placeholderTextColor={theme.inputPlaceholder}
							autoCorrect={false}
							returnKeyType="search"
						/>
						{search.length > 0 && (
							<Pressable onPress={() => setSearch("")} hitSlop={10} accessibilityLabel="Clear search">
								<Ionicons name="close-circle" size={16} color={theme.textTertiary} />
							</Pressable>
						)}
					</View>

					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						style={styles.chipScroller}
						contentContainerStyle={styles.chipRow}
						keyboardShouldPersistTaps="handled"
					>
						{(["all", ...MUSCLE_GROUPS] as Filter[]).map((group) => {
							const active = filter === group;
							return (
								<Pressable
									key={group}
									style={[styles.chip, active && styles.chipActive]}
									onPress={() => setFilter(group)}
									accessibilityRole="button"
									accessibilityState={{ selected: active }}
								>
									<Text style={[styles.chipText, active && styles.chipTextActive]}>{group === "all" ? "All" : MUSCLE_GROUP_LABELS[group]}</Text>
								</Pressable>
							);
						})}
					</ScrollView>

					{catalog.error ? (
						<View style={styles.centerBox}>
							<Text style={styles.mutedText}>Couldn&apos;t load exercises.</Text>
							<Pressable onPress={catalog.retry} hitSlop={8} accessibilityRole="button">
								<Text style={styles.linkText}>Try again</Text>
							</Pressable>
						</View>
					) : !catalog.exercises ? (
						<View style={styles.centerBox}>
							<ActivityIndicator color={theme.primary} />
						</View>
					) : (
						<FlatList
							style={styles.list}
							data={results}
							keyExtractor={(e) => String(e.catalog_id)}
							keyboardShouldPersistTaps="handled"
							renderItem={({ item }) => (
								<Pressable style={styles.row} onPress={() => pick(item)} accessibilityRole="button">
									<Text style={styles.rowName}>{item.name}</Text>
									<Text style={styles.rowGroup}>{MUSCLE_GROUP_LABELS[item.muscle_group] ?? item.muscle_group}</Text>
								</Pressable>
							)}
							ListEmptyComponent={canCreate ? null : <Text style={[styles.mutedText, { paddingVertical: 16 }]}>No exercises match that search.</Text>}
							ListFooterComponent={createFooter}
						/>
					)}
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}

function createStyles(theme: Theme, bottomInset: number) {
	return StyleSheet.create({
		overlay: { flex: 1, backgroundColor: theme.overlay },
		sheet: {
			height: "85%",
			backgroundColor: theme.cardBg,
			borderTopLeftRadius: 20,
			borderTopRightRadius: 20,
			paddingHorizontal: 16,
			paddingTop: 20,
			paddingBottom: bottomInset + 8,
		},
		headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
		title: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 30, color: theme.text },

		searchBox: {
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
			height: 44,
			paddingHorizontal: 12,
			borderRadius: 12,
			borderWidth: 1,
			borderColor: theme.inputBorder,
			backgroundColor: theme.inputBg,
		},
		searchInput: { flex: 1, color: theme.text, fontSize: 15, paddingVertical: 0 },

		chipScroller: { flexGrow: 0, flexShrink: 0 },
		chipRow: { gap: 8, paddingVertical: 12, alignItems: "center" },
		list: { flex: 1 }, //takes whatever height is left under the search + chips
		chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.cardBg },
		chipActive: { borderColor: theme.primary, backgroundColor: `${theme.primary}22` },
		chipText: { fontSize: 13, fontWeight: "600", color: theme.textMuted },
		chipTextActive: { color: theme.primary },

		row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.borderLight },
		rowName: { fontSize: 16, fontWeight: "600", color: theme.text },
		rowGroup: { fontSize: 13, color: theme.textMuted, marginTop: 2 },

		centerBox: { paddingVertical: 32, alignItems: "center", gap: 8 },
		mutedText: { fontSize: 14, color: theme.textMuted },
		linkText: { fontSize: 15, fontWeight: "600", color: theme.primary },
		errorText: { fontSize: 13, color: theme.error, marginTop: 4 },

		createBox: { marginTop: 16, padding: 14, gap: 8, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.cardBgAlt },
		createTitle: { fontSize: 16, fontWeight: "700", color: theme.text },
		createHint: { fontSize: 13, color: theme.textMuted },
		createButton: { height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.primary, marginTop: 4 },
		createButtonText: { fontSize: 15, fontWeight: "700", color: theme.textInverse },
		disabled: { opacity: 0.5 },
	});
}
