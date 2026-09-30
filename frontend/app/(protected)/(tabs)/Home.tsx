import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useMemo, useState, useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/typography";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import { todayISO, formatRelativeDate } from "@/utils/date";
import { useProfile } from "@/utils/ProfileProvider";
import { ScreenState } from "@/components/ScreenState";
import { PressableScale } from "@/components/PressableScale";
import { Tasks } from "@/components/Tasks";
import Screen from "@/components/Screen";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NutrientSummary {
	calories: number;
	protein: number;
	carbs: number;
	fat: number;
}

interface Workout {
	id: string;
	name: string;
	date: string;
	duration_minutes: number;
	total_volume_kg?: number;
}

// % of goal, guarding against a 0 / missing goal.
const pctOfGoal = (current: number, goal: number) => (goal > 0 ? (current / goal) * 100 : 0);

function greeting(now = new Date()) {
	const h = now.getHours();
	if (h < 12) return "Good morning";
	if (h < 18) return "Good afternoon";
	return "Good evening";
}

const goToNewWorkout = () =>
	router.push({ pathname: "/(protected)/workouts/[workout_id]", params: { workout_id: "new", mode: "new" } });

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function Home() {
	const { theme } = useTheme();
	const { goals, profile } = useProfile();

	const [summary, setSummary] = useState<NutrientSummary | null>(null);
	const [workouts, setWorkouts] = useState<Workout[]>([]);
	const calorieGoal = goals.calories;
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	const fetchData = useCallback(async () => {
		try {
			const today = todayISO();

			// Fetch today's diary entries and sum nutrients
			const [diaryRes, workoutsRes] = await Promise.allSettled([
				instance.get(`/nutrition/diary?start_date=${today}&end_date=${today}`),
				instance.get("/workouts"),
			]);

			if (diaryRes.status === "fulfilled") {
				const entries: any[] = diaryRes.value.data.diary_entries ?? [];
				const totals = entries.reduce(
					(acc, e) => {
						const n = e.nutrients;
						if (!n) return acc;
						return {
							calories: acc.calories + (n.calories ?? 0),
							protein: acc.protein + (n.protein ?? 0),
							carbs: acc.carbs + (n.carbs ?? 0),
							fat: acc.fat + (n.fat ?? 0),
						};
					},
					{ calories: 0, protein: 0, carbs: 0, fat: 0 },
				);
				setSummary(totals);
			}

			if (workoutsRes.status === "fulfilled") {
				setWorkouts(workoutsRes.value.data.workouts?.slice(0, 3) ?? []);
			}

			// Both endpoints down → show a real error, not an empty-looking dashboard.
			if (diaryRes.status === "rejected" && workoutsRes.status === "rejected") {
				log.error("Dashboard fetch error:", diaryRes.reason, workoutsRes.reason);
				setError(true);
			} else {
				setError(false);
			}
		} catch (e) {
			log.error("Dashboard fetch error:", e);
			setError(true);
		} finally {
			setLoading(false);
		}
	}, []);

	// Reload on focus so logging food or finishing a workout is reflected when you
	// land back on the dashboard. fetchData also drives the retry button.
	useFocusEffect(
		useCallback(() => {
			fetchData();
		}, [fetchData]),
	);

	const styles = useMemo(
		() =>
			StyleSheet.create({
				scroll: { flex: 1 },
				content: { padding: 20, paddingBottom: 32, gap: 20 },

				// Header
				greeting: {
					fontSize: 30,
					lineHeight: 36,
					fontFamily: fonts.headingHeavy,
					color: theme.text,
				},
				dateLine: {
					fontSize: 14,
					color: theme.textMuted,
				},

				// Cards
				card: {
					backgroundColor: theme.cardBg,
					borderRadius: 20,
					padding: 20,
					borderWidth: 1,
					borderColor: theme.border,
				},
				listCard: {
					backgroundColor: theme.cardBg,
					borderRadius: 16,
					paddingHorizontal: 16,
					borderWidth: 1,
					borderColor: theme.border,
				},

				// Calories left — the one big number on the screen
				calNumber: {
					fontSize: 56,
					lineHeight: 60,
					fontFamily: fonts.headingHeavy,
					color: theme.primary,
				},
				calCaption: {
					fontSize: 16,
					fontWeight: "600",
					color: theme.text,
				},
				calSub: {
					fontSize: 14,
					color: theme.textMuted,
					marginTop: 2,
				},

				// Progress bars
				barTrack: {
					height: 8,
					backgroundColor: theme.cardBgAlt,
					borderRadius: 4,
					overflow: "hidden",
				},
				barFill: {
					height: 8,
					borderRadius: 4,
				},
				calBar: { marginTop: 16 },

				// Macros
				macroList: { marginTop: 20, gap: 12 },
				macroHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
				macroName: { fontSize: 14, fontWeight: "600", color: theme.text },
				macroAmount: { fontSize: 14, color: theme.textMuted },

				// Section header
				sectionRow: {
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: 12,
				},
				sectionTitle: {
					fontSize: 20,
					lineHeight: 26,
					fontFamily: fonts.heading,
					color: theme.text,
				},
				viewAll: {
					fontSize: 14,
					fontWeight: "600",
					color: theme.primary,
				},

				// CTA buttons
				ctaRow: {
					flexDirection: "row",
					gap: 12,
				},
				ctaPrimary: {
					flex: 1,
					backgroundColor: theme.primary,
					borderRadius: 14,
					paddingVertical: 16,
					alignItems: "center",
					flexDirection: "row",
					justifyContent: "center",
					gap: 8,
				},
				ctaSecondary: {
					flex: 1,
					backgroundColor: theme.cardBg,
					borderRadius: 14,
					paddingVertical: 16,
					alignItems: "center",
					flexDirection: "row",
					justifyContent: "center",
					gap: 8,
					borderWidth: 1.5,
					borderColor: theme.primary,
				},
				ctaPrimaryText: {
					fontSize: 15,
					fontWeight: "700",
					color: theme.textInverse,
				},
				ctaSecondaryText: {
					fontSize: 15,
					fontWeight: "700",
					color: theme.primary,
				},

				// Workout row
				workoutRow: {
					flexDirection: "row",
					alignItems: "center",
					paddingVertical: 14,
					borderBottomWidth: 1,
					borderBottomColor: theme.border,
					gap: 14,
				},
				workoutIcon: {
					width: 40,
					height: 40,
					borderRadius: 12,
					backgroundColor: theme.cardBgAlt,
					alignItems: "center",
					justifyContent: "center",
				},
				workoutName: {
					fontSize: 15,
					fontWeight: "700",
					color: theme.text,
				},
				workoutMeta: {
					fontSize: 13,
					color: theme.textMuted,
					marginTop: 2,
				},
				workoutChevron: {
					marginLeft: "auto",
				},

				emptyWrap: {
					alignItems: "center",
					paddingVertical: 20,
					gap: 12,
				},
				emptyText: {
					fontSize: 14,
					color: theme.textMuted,
					textAlign: "center",
				},
				emptyButton: {
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
					backgroundColor: theme.cardBgAlt,
					borderRadius: 999,
					paddingHorizontal: 16,
					paddingVertical: 10,
				},
				emptyButtonText: { fontSize: 14, fontWeight: "700", color: theme.primary },
			}),
		[theme],
	);

	const eaten = Math.round(summary?.calories ?? 0);
	const left = calorieGoal - eaten;
	const calPercent = pctOfGoal(eaten, calorieGoal);
	const firstName = profile?.first_name?.trim();
	const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

	const macros = [
		{ key: "protein", label: "Protein", color: theme.macroProtein },
		{ key: "carbs", label: "Carbs", color: theme.macroCarbs },
		{ key: "fat", label: "Fat", color: theme.macroFat },
	] as const;

	return (
		<Screen edges={["top"]}>
			<ScreenState loading={loading} error={error} onRetry={fetchData} errorTitle="Couldn't load today">
				<ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
					{/* Header */}
					<View>
						<Text style={styles.greeting} accessibilityRole="header">
							{greeting()}
							{firstName ? `, ${firstName}` : ""}
						</Text>
						<Text style={styles.dateLine}>{todayLabel}</Text>
					</View>

					{/* Calories left today */}
					<View style={styles.card}>
						<Text style={styles.calNumber}>{Math.abs(left).toLocaleString()}</Text>
						<Text style={styles.calCaption}>{left >= 0 ? "calories left today" : "calories over your goal"}</Text>
						<Text style={styles.calSub}>
							{eaten.toLocaleString()} of {calorieGoal.toLocaleString()} eaten
						</Text>
						<View
							style={[styles.barTrack, styles.calBar]}
							accessibilityRole="progressbar"
							accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(calPercent, 100)) }}
						>
							<View style={[styles.barFill, { width: `${Math.min(calPercent, 100)}%`, backgroundColor: theme.primary }]} />
						</View>

						{summary && (
							<View style={styles.macroList}>
								{macros.map((m) => {
									const current = Math.round(summary[m.key]);
									const goal = goals[m.key];
									const pct = Math.min(pctOfGoal(current, goal), 100);
									return (
										<View key={m.key}>
											<View style={styles.macroHead}>
												<Text style={styles.macroName}>{m.label}</Text>
												<Text style={styles.macroAmount}>
													{current} / {goal} g
												</Text>
											</View>
											<View style={styles.barTrack}>
												<View style={[styles.barFill, { width: `${pct}%`, backgroundColor: m.color }]} />
											</View>
										</View>
									);
								})}
							</View>
						)}
					</View>

					{/* CTA buttons */}
					<View style={styles.ctaRow}>
						<PressableScale style={styles.ctaPrimary} onPress={() => router.push("/nutrition/Nutrition")} accessibilityRole="button">
							<FontAwesome5 name="utensils" size={14} color={theme.textInverse} />
							<Text style={styles.ctaPrimaryText}>Log food</Text>
						</PressableScale>
						<PressableScale style={styles.ctaSecondary} onPress={goToNewWorkout} accessibilityRole="button">
							<FontAwesome5 name="play" size={12} color={theme.primary} />
							<Text style={styles.ctaSecondaryText}>Start workout</Text>
						</PressableScale>
					</View>

					{/* Tasks -- might also add challanges here instead*/}
					<Tasks />

					{/* Recent workouts */}
					<View>
						<View style={styles.sectionRow}>
							<Text style={styles.sectionTitle} accessibilityRole="header">
								Recent workouts
							</Text>
							{workouts.length > 0 && (
								<TouchableOpacity onPress={() => router.push("/Workouts")} hitSlop={10} accessibilityRole="link">
									<Text style={styles.viewAll}>See all</Text>
								</TouchableOpacity>
							)}
						</View>

						<View style={styles.listCard}>
							{workouts.length === 0 ? (
								<View style={styles.emptyWrap}>
									<Text style={styles.emptyText}>Your workouts will show up here.</Text>
									<TouchableOpacity style={styles.emptyButton} onPress={goToNewWorkout} accessibilityRole="button">
										<FontAwesome5 name="play" size={11} color={theme.primary} />
										<Text style={styles.emptyButtonText}>Start your first workout</Text>
									</TouchableOpacity>
								</View>
							) : (
								workouts.map((w, i) => (
									<TouchableOpacity
										key={w.id}
										style={[styles.workoutRow, i === workouts.length - 1 && { borderBottomWidth: 0 }]}
										onPress={() => router.push(`/(protected)/workouts/${w.id}`)}
										activeOpacity={0.7}
										accessibilityRole="button"
									>
										<View style={styles.workoutIcon}>
											<FontAwesome5 name="dumbbell" size={14} color={theme.primary} />
										</View>
										<View style={{ flex: 1 }}>
											<Text style={styles.workoutName}>{w.name}</Text>
											<Text style={styles.workoutMeta}>
												{[
													formatRelativeDate(w.date),
													w.duration_minutes ? `${w.duration_minutes} min` : null,
													w.total_volume_kg ? `${w.total_volume_kg.toLocaleString()} kg lifted` : null,
												]
													.filter(Boolean)
													.join(", ")}
											</Text>
										</View>
										<FontAwesome5 name="chevron-right" size={12} color={theme.textTertiary} style={styles.workoutChevron} />
									</TouchableOpacity>
								))
							)}
						</View>
					</View>
				</ScrollView>
			</ScreenState>
		</Screen>
	);
}
