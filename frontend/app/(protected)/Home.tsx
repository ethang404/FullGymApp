import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo, useEffect, useState } from "react";
import { router } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import { todayISO, formatRelativeDate } from "@/utils/date";
import { useProfile } from "@/utils/ProfileProvider";

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function RingProgress({
	percent,
	size = 72,
	strokeWidth = 7,
	color,
	trackColor,
	label,
}: {
	percent: number;
	size?: number;
	strokeWidth?: number;
	color: string;
	trackColor: string;
	label: string;
}) {
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const filled = circumference * Math.min(percent / 100, 1);

	return (
		<View style={{ alignItems: "center", gap: 4 }}>
			<View style={{ width: size, height: size }}>
				{/* Track */}
				<View
					style={{
						position: "absolute",
						width: size,
						height: size,
						borderRadius: size / 2,
						borderWidth: strokeWidth,
						borderColor: trackColor,
					}}
				/>
				{/* We use a simple arc approximation with border trick */}
				<View
					style={{
						position: "absolute",
						width: size,
						height: size,
						borderRadius: size / 2,
						borderWidth: strokeWidth,
						borderColor: "transparent",
						borderTopColor: color,
						borderRightColor: percent > 25 ? color : "transparent",
						borderBottomColor: percent > 50 ? color : "transparent",
						borderLeftColor: percent > 75 ? color : "transparent",
						transform: [{ rotate: "-90deg" }],
					}}
				/>
				<View
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Text style={{ fontSize: 13, fontWeight: "700", color }}>{Math.round(percent)}%</Text>
				</View>
			</View>
			<Text style={{ fontSize: 11, color, fontWeight: "600", letterSpacing: 0.5 }}>{label}</Text>
		</View>
	);
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function Home() {
	const { theme } = useTheme();
	const { goals } = useProfile();

	const [summary, setSummary] = useState<NutrientSummary | null>(null);
	const [workouts, setWorkouts] = useState<Workout[]>([]);
	const calorieGoal = goals.calories;
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function fetchData() {
			try {
				const today = todayISO();

				// Fetch today's diary entries and sum nutrients
				const [diaryRes, workoutsRes] = await Promise.allSettled([
					instance.get(`/nutrition/diary?start_date=${today}&end_date=${today}`),
					instance.get("/Workouts?limit=3"),
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
			} catch (e) {
				log.error("Dashboard fetch error:", e);
			} finally {
				setLoading(false);
			}
		}

		fetchData();
	}, []);

	const styles = useMemo(
		() =>
			StyleSheet.create({
				safe: { flex: 1, backgroundColor: theme.background },
				scroll: { flex: 1 },
				content: { padding: 20, paddingBottom: 32, gap: 20 },

				// Header
				header: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: 4,
				},
				appName: {
					fontSize: 18,
					fontWeight: "800",
					color: theme.primary,
					letterSpacing: 2,
					textTransform: "uppercase",
				},

				// Cards
				card: {
					backgroundColor: theme.cardBg,
					borderRadius: 16,
					padding: 18,
					borderWidth: 1,
					borderColor: theme.border,
				},
				cardAlt: {
					backgroundColor: theme.cardBgAlt,
					borderRadius: 16,
					padding: 18,
					borderWidth: 1,
					borderColor: theme.border,
				},

				// Calorie hero
				calLabel: {
					fontSize: 11,
					fontWeight: "700",
					color: theme.textMuted,
					letterSpacing: 1.5,
					textTransform: "uppercase",
					marginBottom: 4,
				},
				calNumber: {
					fontSize: 48,
					fontWeight: "800",
					color: theme.text,
					lineHeight: 52,
				},
				calGoal: {
					fontSize: 13,
					color: theme.textMuted,
					marginTop: 2,
				},
				calRow: {
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
				},

				// Progress bar
				barTrack: {
					height: 4,
					backgroundColor: theme.border,
					borderRadius: 2,
					marginTop: 14,
					overflow: "hidden",
				},
				barFill: {
					height: 4,
					backgroundColor: theme.primary,
					borderRadius: 2,
				},

				// Macro rings row
				macroRow: {
					flexDirection: "row",
					justifyContent: "space-around",
					marginTop: 4,
				},

				// Section header
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
				viewAll: {
					fontSize: 12,
					fontWeight: "700",
					color: theme.primary,
					letterSpacing: 0.5,
					textTransform: "uppercase",
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
					backgroundColor: theme.cardBgAlt,
					borderRadius: 14,
					paddingVertical: 16,
					alignItems: "center",
					flexDirection: "row",
					justifyContent: "center",
					gap: 8,
					borderWidth: 1,
					borderColor: theme.border,
				},
				ctaPrimaryText: {
					fontSize: 14,
					fontWeight: "800",
					color: theme.textInverse,
					textTransform: "uppercase",
					letterSpacing: 0.5,
				},
				ctaSecondaryText: {
					fontSize: 14,
					fontWeight: "800",
					color: theme.text,
					textTransform: "uppercase",
					letterSpacing: 0.5,
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
					borderWidth: 1,
					borderColor: theme.border,
				},
				workoutName: {
					fontSize: 15,
					fontWeight: "700",
					color: theme.text,
				},
				workoutMeta: {
					fontSize: 12,
					color: theme.textMuted,
					marginTop: 2,
				},
				workoutChevron: {
					marginLeft: "auto",
				},

				emptyText: {
					fontSize: 14,
					color: theme.textMuted,
					textAlign: "center",
					paddingVertical: 16,
				},
			}),
		[theme],
	);

	const calPercent = summary ? (summary.calories / calorieGoal) * 100 : 0;

	if (loading) {
		return (
			<SafeAreaView style={[styles.safe, { justifyContent: "center", alignItems: "center" }]}>
				<ActivityIndicator color={theme.primary} size="large" />
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				{/* Header */}
				<View style={styles.header}>
					<Text style={styles.appName}>Kratos</Text>
					<FontAwesome5 name="bell" size={18} color={theme.textMuted} />
				</View>

				{/* Calorie card */}
				<View style={styles.card}>
					<Text style={styles.calLabel}>Daily Calories</Text>
					<View style={styles.calRow}>
						<View>
							<Text style={styles.calNumber}>{summary?.calories.toLocaleString() ?? "0"}</Text>
							<Text style={styles.calGoal}>of {calorieGoal.toLocaleString()} kcal</Text>
						</View>
						<RingProgress percent={calPercent} color={theme.primary} trackColor={theme.border} label="GOAL" size={80} strokeWidth={8} />
					</View>
					<View style={styles.barTrack}>
						<View style={[styles.barFill, { width: `${Math.min(calPercent, 100)}%` }]} />
					</View>

					{/* Macro rings */}
					{summary && (
						<View style={styles.macroRow}>
							<RingProgress percent={(summary.protein / goals.protein) * 100} color={theme.macroProtein} trackColor={theme.border} label="PROTEIN" size={64} strokeWidth={6} />
							<RingProgress percent={(summary.carbs / goals.carbs) * 100} color={theme.macroCarbs} trackColor={theme.border} label="CARBS" size={64} strokeWidth={6} />
							<RingProgress percent={(summary.fat / goals.fat) * 100} color={theme.macroFat} trackColor={theme.border} label="FAT" size={64} strokeWidth={6} />
						</View>
					)}
				</View>

				{/* CTA buttons */}
				<View style={styles.ctaRow}>
					<TouchableOpacity style={styles.ctaPrimary} onPress={() => router.push("/(protected)/nutrition/Nutrition")} activeOpacity={0.8}>
						<FontAwesome5 name="utensils" size={14} color={theme.textInverse} />
						<Text style={styles.ctaPrimaryText}>Log Food</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.ctaSecondary} onPress={() => router.push("/(protected)/Workouts")} activeOpacity={0.8}>
						<FontAwesome5 name="dumbbell" size={14} color={theme.text} />
						<Text style={styles.ctaSecondaryText}>Workout</Text>
					</TouchableOpacity>
				</View>

				{/* Recent workouts */}
				<View>
					<View style={styles.sectionRow}>
						<Text style={styles.sectionTitle}>Recent Workouts</Text>
						<TouchableOpacity onPress={() => router.push("/(protected)/Workouts")}>
							<Text style={styles.viewAll}>View All</Text>
						</TouchableOpacity>
					</View>

					<View style={styles.card}>
						{workouts.length === 0 ? (
							<Text style={styles.emptyText}>No workouts yet. Start one!</Text>
						) : (
							workouts.map((w, i) => (
								<TouchableOpacity
									key={w.id}
									style={[styles.workoutRow, i === workouts.length - 1 && { borderBottomWidth: 0 }]}
									onPress={() => router.push(`/(protected)/workouts/${w.id}`)}
									activeOpacity={0.7}
								>
									<View style={styles.workoutIcon}>
										<FontAwesome5 name="dumbbell" size={14} color={theme.primary} />
									</View>
									<View style={{ flex: 1 }}>
										<Text style={styles.workoutName}>{w.name}</Text>
										<Text style={styles.workoutMeta}>
											{formatRelativeDate(w.date)}
											{w.duration_minutes ? ` · ${w.duration_minutes}m` : ""}
											{w.total_volume_kg ? ` · ${w.total_volume_kg.toLocaleString()}kg` : ""}
										</Text>
									</View>
									<FontAwesome5 name="chevron-right" size={12} color={theme.textTertiary} style={styles.workoutChevron} />
								</TouchableOpacity>
							))
						)}
					</View>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}
