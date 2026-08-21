import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo, useEffect, useState, useCallback } from "react";
import { router } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";

interface Workout {
	id: string;
	name: string;
	date: string;
	duration_minutes?: number;
	total_volume_kg?: number;
	notes?: string;
}

// Helper functions here

//General Date formatting to help with errors
function formatDate(dateStr: string) {
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return "Unknown date";
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRelativeDate(dateStr: string) {
	const date = new Date(dateStr);
	if (isNaN(date.getTime())) return "Unknown date";
	const now = new Date();
	const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 7) return `${diffDays} days ago`;
	return formatDate(dateStr);
}

export default function Workouts() {
	const { theme } = useTheme();
	const [workouts, setWorkouts] = useState<Workout[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);

	async function fetchWorkouts() {
		try {
			const res = await instance.get("/workouts/");
			setWorkouts(res.data.workouts ?? []);
		} catch (e) {
			console.error("Workouts fetch error:", e);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}

	useEffect(() => {
		fetchWorkouts();
	}, []);

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

	if (loading) {
		return (
			<SafeAreaView style={[styles.safe, { justifyContent: "center", alignItems: "center" }]}>
				<ActivityIndicator color={theme.primary} size="large" />
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => {
							setRefreshing(true);
							fetchWorkouts();
						}}
						tintColor={theme.primary}
					/>
				}
			>
				{/* Header */}
				<View style={styles.header}>
					<Text style={styles.pageTitle}>Workouts</Text>
					<TouchableOpacity style={styles.newBtn} activeOpacity={0.8}>
						<FontAwesome5 name="plus" size={11} color={theme.textInverse} />
						<Text style={styles.newBtnText}>New</Text>
					</TouchableOpacity>
				</View>

				{/* Start session */}
				<View style={styles.ctaBanner}>
					<Text style={styles.ctaTitle}>Ready to train?</Text>
					<Text style={styles.ctaSub}>Log your sets, track your progress, beat your records.</Text>
					<TouchableOpacity
						style={styles.ctaButton}
						activeOpacity={0.8}
						onPress={() => {
							router.push({
								pathname: "/(protected)/workouts/[workout_id]",
								params: { workout_id: "new", mode: "new" },
							});
						}}
					>
						<FontAwesome5 name="play" size={12} color={theme.textInverse} />
						<Text style={styles.ctaButtonText}>Start New Session</Text>
					</TouchableOpacity>
				</View>

				{/* Workout history list*/}
				{workouts.length === 0 ? (
					<View style={styles.emptyState}>
						<FontAwesome5 name="dumbbell" size={32} color={theme.textTertiary} />
						<Text style={styles.emptyTitle}>No workouts yet</Text>
						<Text style={styles.emptySubtitle}>Start your first session to begin tracking</Text>
					</View>
				) : (
					<>
						<Text style={styles.sectionLabel}>History</Text>
						{workouts.map((w) => (
							<TouchableOpacity
								key={w.id}
								style={styles.workoutCard}
								onPress={() => {
									router.push({
										pathname: "/(protected)/workouts/[workout_id]",
										params: { workout_id: w.id, mode: "edit" },
									});
								}}
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
						))}
					</>
				)}
			</ScrollView>
		</SafeAreaView>
	);
}
