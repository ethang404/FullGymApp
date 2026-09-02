import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo, useState, useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import { toast } from "@/utils/toast";
import { formatRelativeDate } from "@/utils/date";
import { ScreenState } from "@/components/ScreenState";

interface Workout {
	id: string;
	name: string;
	date: string;
	duration_minutes?: number;
	total_volume_kg?: number;
	notes?: string;
}

export default function Workouts() {
	const { theme } = useTheme();
	const [workouts, setWorkouts] = useState<Workout[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState(false);

	async function fetchWorkouts(isRefresh = false) {
		try {
			const res = await instance.get("/workouts/");
			setWorkouts(res.data.workouts ?? []);
			setError(false);
		} catch (e) {
			log.error("Workouts fetch error:", e);
			if (isRefresh) toast.error("Couldn't refresh. Pull down to try again.");
			else setError(true);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}

	// Refetch whenever the tab regains focus, so a workout saved on the editor
	// screen shows up when you come back here.
	useFocusEffect(
		useCallback(() => {
			fetchWorkouts();
		}, []),
	);

	const goToNewWorkout = () =>
		router.push({ pathname: "/(protected)/workouts/[workout_id]", params: { workout_id: "new", mode: "new" } });

	const styles = useMemo(
		() =>
			StyleSheet.create({
				safe: { flex: 1, backgroundColor: theme.background },
				scroll: { flex: 1 },
				content: { padding: 16, paddingBottom: 32, gap: 12 },

				header: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: 8,
				},
				pageTitle: {
					fontSize: 22,
					fontWeight: "800",
					color: theme.text,
				},
				newBtn: {
					flexDirection: "row",
					alignItems: "center",
					gap: 6,
					backgroundColor: theme.primary,
					paddingHorizontal: 14,
					paddingVertical: 9,
					borderRadius: 10,
				},
				newBtnText: {
					fontSize: 12,
					fontWeight: "700",
					color: theme.textInverse,
					textTransform: "uppercase",
					letterSpacing: 0.5,
				},

				//Start workout btn stuff
				ctaBanner: {
					backgroundColor: theme.cardBg,
					borderRadius: 16,
					padding: 20,
					borderWidth: 1,
					borderColor: theme.border,
					marginBottom: 4,
				},
				ctaTitle: {
					fontSize: 20,
					fontWeight: "800",
					color: theme.text,
					marginBottom: 6,
				},
				ctaSub: {
					fontSize: 13,
					color: theme.textMuted,
					marginBottom: 16,
					lineHeight: 19,
				},
				ctaButton: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "center",
					gap: 8,
					backgroundColor: theme.primary,
					borderRadius: 12,
					paddingVertical: 14,
				},
				ctaButtonText: {
					fontSize: 14,
					fontWeight: "800",
					color: theme.textInverse,
					textTransform: "uppercase",
					letterSpacing: 0.5,
				},

				sectionLabel: {
					fontSize: 11,
					fontWeight: "700",
					color: theme.textMuted,
					letterSpacing: 1.5,
					textTransform: "uppercase",
					marginBottom: 8,
					marginTop: 4,
				},

				// Workout card stuff
				workoutCard: {
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
				workoutName: {
					fontSize: 15,
					fontWeight: "700",
					color: theme.text,
				},
				workoutDate: {
					fontSize: 12,
					color: theme.textMuted,
					marginTop: 2,
				},
				workoutStats: {
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

				emptyState: {
					alignItems: "center",
					paddingVertical: 40,
					gap: 8,
				},
				emptyTitle: {
					fontSize: 16,
					fontWeight: "700",
					color: theme.textMuted,
				},
				emptySubtitle: {
					fontSize: 13,
					color: theme.textTertiary,
					textAlign: "center",
				},
			}),
		[theme],
	);

	const renderWorkout = useCallback(
		({ item: w }: { item: Workout }) => (
			<TouchableOpacity
				style={styles.workoutCard}
				onPress={() => router.push({ pathname: "/(protected)/workouts/[workout_id]", params: { workout_id: w.id, mode: "edit" } })}
				activeOpacity={0.7}
			>
				<View style={styles.iconWrap}>
					<FontAwesome5 name="dumbbell" size={16} color={theme.primary} />
				</View>
				<View style={{ flex: 1 }}>
					<Text style={styles.workoutName}>{w.name}</Text>
					<Text style={styles.workoutDate}>{formatRelativeDate(w.date)}</Text>
					{(w.duration_minutes || w.total_volume_kg) && (
						<View style={styles.workoutStats}>
							{w.duration_minutes && (
								<View style={styles.stat}>
									<FontAwesome5 name="clock" size={10} color={theme.textTertiary} />
									<Text style={styles.statText}>{w.duration_minutes}m</Text>
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
		),
		[styles, theme],
	);

	const listHeader = (
		<>
			<View style={styles.header}>
				<Text style={styles.pageTitle}>Workouts</Text>
				<TouchableOpacity style={styles.newBtn} activeOpacity={0.8} onPress={goToNewWorkout}>
					<FontAwesome5 name="plus" size={11} color={theme.textInverse} />
					<Text style={styles.newBtnText}>New</Text>
				</TouchableOpacity>
			</View>

			<View style={styles.ctaBanner}>
				<Text style={styles.ctaTitle}>Ready to train?</Text>
				<Text style={styles.ctaSub}>Log your sets, track your progress, beat your records.</Text>
				<TouchableOpacity style={styles.ctaButton} activeOpacity={0.8} onPress={goToNewWorkout}>
					<FontAwesome5 name="play" size={12} color={theme.textInverse} />
					<Text style={styles.ctaButtonText}>Start New Session</Text>
				</TouchableOpacity>
			</View>

			{workouts.length > 0 && <Text style={styles.sectionLabel}>History</Text>}
		</>
	);

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<ScreenState loading={loading} error={error} onRetry={fetchWorkouts} errorTitle="Couldn't load your workouts">
				<FlatList
					data={workouts}
					keyExtractor={(w) => w.id}
					renderItem={renderWorkout}
					ListHeaderComponent={listHeader}
					ListEmptyComponent={
						<View style={styles.emptyState}>
							<FontAwesome5 name="dumbbell" size={32} color={theme.textTertiary} />
							<Text style={styles.emptyTitle}>No workouts yet</Text>
							<Text style={styles.emptySubtitle}>Start your first session to begin tracking</Text>
						</View>
					}
					style={styles.scroll}
					contentContainerStyle={styles.content}
					showsVerticalScrollIndicator={false}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={() => {
								setRefreshing(true);
								fetchWorkouts(true);
							}}
							tintColor={theme.primary}
						/>
					}
				/>
			</ScreenState>
		</SafeAreaView>
	);
}
