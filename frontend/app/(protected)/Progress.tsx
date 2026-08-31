import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Pressable, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo, useEffect, useState } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { LineChart, BarChart, PieChart } from "react-native-gifted-charts";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { ChartCard } from "@/components/ChartCard";
import { ExerciseHistoryModal } from "@/components/ExerciseHistoryModal";
import { getMuscleGroupColor } from "@/theme/chartColors";

type FilterOption = "week" | "month" | "year" | "all";

interface LiftChange {
	catalog_id: number;
	name: string;
	muscle_group: string;
	first_value: number;
	last_value: number;
	first_date: string;
	last_date: string;
	percent_change: number;
}

interface VolumeByMuscleGroupResponse {
	total_volume: number;
	breakdown: { muscle_group: string; volume: number; percent: number }[];
}

interface FatigueCurvePoint {
	order_number: number;
	avg_value: number;
	avg_percent_of_best: number;
	sample_size: number;
}

interface FatigueCurve {
	catalog_id: number;
	name: string;
	muscle_group: string;
	curve: FatigueCurvePoint[];
}

interface WeeklyLandmarksWeek {
	week_start: string;
	week_end: string;
	muscle_groups: { muscle_group: string; set_count: number; classification: "high" | "moderate" | "low" }[];
}

interface PersonalRecord {
	catalog_id: number;
	name: string;
	muscle_group: string;
	workout_date: string;
	value: number;
}

interface TrainingFrequencyWeek {
	week_start: string;
	week_end: string;
	session_count: number;
}

interface SessionTrendsWeek {
	week_start: string;
	week_end: string;
	avg_volume: number | null;
	avg_duration_minutes: number | null;
	session_count: number;
}

interface RepRangeBucket {
	range: "1-5" | "6-12" | "13+";
	set_count: number;
	percent: number;
}

interface ProgressData {
	changes: LiftChange[];
	volumeByMuscleGroup: VolumeByMuscleGroupResponse | null;
	fatigueCurves: FatigueCurve[];
	weeklyLandmarks: WeeklyLandmarksWeek[];
	personalRecords: PersonalRecord[];
	trainingFrequency: TrainingFrequencyWeek[];
	sessionTrends: SessionTrendsWeek[];
	repRangeDistribution: RepRangeBucket[];
}

const EMPTY_DATA: ProgressData = {
	changes: [],
	volumeByMuscleGroup: null,
	fatigueCurves: [],
	weeklyLandmarks: [],
	personalRecords: [],
	trainingFrequency: [],
	sessionTrends: [],
	repRangeDistribution: [],
};

const FILTERS: { value: FilterOption; label: string }[] = [
	{ value: "week", label: "Week" },
	{ value: "month", label: "Month" },
	{ value: "year", label: "Year" },
	{ value: "all", label: "All" },
];

const REP_RANGE_ORDER: RepRangeBucket["range"][] = ["1-5", "6-12", "13+"];

const ENDPOINTS: { url: string; key: keyof ProgressData; params?: Record<string, string>; extract: (body: any) => any }[] = [
	{ url: "/workouts/progress/biggest-changes", key: "changes", extract: (b) => b.changes ?? [] },
	{ url: "/workouts/progress/volume-by-muscle-group", key: "volumeByMuscleGroup", extract: (b) => b ?? null },
	{ url: "/workouts/progress/fatigue-curves", key: "fatigueCurves", params: { epley: "true" }, extract: (b) => b.curves ?? [] },
	{ url: "/workouts/progress/weekly-volume-landmarks", key: "weeklyLandmarks", extract: (b) => b.weeks ?? [] },
	{ url: "/workouts/progress/personal-records", key: "personalRecords", extract: (b) => b.records ?? [] },
	{ url: "/workouts/progress/training-frequency", key: "trainingFrequency", extract: (b) => b.weeks ?? [] },
	{ url: "/workouts/progress/session-trends", key: "sessionTrends", extract: (b) => b.weeks ?? [] },
	{ url: "/workouts/progress/rep-range-distribution", key: "repRangeDistribution", extract: (b) => b.distribution ?? [] },
];

function formatDate(dateStr: string) {
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return "Unknown date";
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function classificationColor(classification: string, theme: ReturnType<typeof useTheme>["theme"]) {
	if (classification === "high") return theme.macroProtein;
	if (classification === "moderate") return theme.macroFat;
	return theme.textTertiary;
}

export default function Progress() {
	const { theme } = useTheme();
	const [filter, setFilter] = useState<FilterOption>("month");
	const [data, setData] = useState<ProgressData>(EMPTY_DATA);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [selectedFatigueCatalogId, setSelectedFatigueCatalogId] = useState<number | null>(null);
	const [historyModal, setHistoryModal] = useState<{ visible: boolean; catalogId: number | null; name: string }>({
		visible: false,
		catalogId: null,
		name: "",
	});

	async function fetchAll(currentFilter: FilterOption) {
		setRefreshing(true);
		const results = await Promise.allSettled(
			ENDPOINTS.map((endpoint) => instance.get(endpoint.url, { params: { filter: currentFilter, ...endpoint.params } })),
		);

		setData((prev) => {
			const next = { ...prev };
			results.forEach((res, i) => {
				const { key, extract } = ENDPOINTS[i];
				if (res.status === "fulfilled") {
					(next as any)[key] = extract(res.value.data);
				} else {
					console.error(`Progress fetch error (${key}):`, res.reason);
				}
			});
			return next;
		});
		setLoading(false);
		setRefreshing(false);
	}

	useEffect(() => {
		fetchAll(filter);
	}, [filter]);

	// Keep the fatigue-curve exercise selector pointed at a curve that still exists after each refetch,
	// falling back to the first available curve inline (below) rather than syncing it via an effect.

	const styles = useMemo(
		() =>
			StyleSheet.create({
				safe: { flex: 1, backgroundColor: theme.background },
				scroll: { flex: 1 },
				content: { padding: 16, paddingBottom: 32, gap: 20 },

				pageTitle: {
					fontSize: 22,
					fontWeight: "800",
					color: theme.text,
				},

				filterRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
				filterChip: {
					paddingHorizontal: 14,
					paddingVertical: 7,
					borderRadius: 20,
					backgroundColor: theme.cardBgAlt,
					borderWidth: 1,
					borderColor: theme.border,
				},
				filterChipActive: {
					backgroundColor: theme.primary,
					borderColor: theme.primary,
				},
				filterChipText: { fontSize: 12, fontWeight: "700", color: theme.textSecondary },
				filterChipTextActive: { color: theme.textInverse },

				row: {
					flexDirection: "row",
					alignItems: "center",
					gap: 12,
					paddingVertical: 10,
					borderBottomWidth: 1,
					borderBottomColor: theme.border,
				},
				rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
				iconWrap: {
					width: 40,
					height: 40,
					borderRadius: 12,
					backgroundColor: theme.cardBgAlt,
					alignItems: "center",
					justifyContent: "center",
					borderWidth: 1,
					borderColor: theme.border,
				},
				rowTitle: { fontSize: 14, fontWeight: "700", color: theme.text },
				rowSubtitle: { fontSize: 11, color: theme.textMuted, marginTop: 1, textTransform: "capitalize" },
				rowValueLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
				rowValueText: { fontSize: 11, color: theme.textSecondary },
				percentWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
				percentText: { fontSize: 14, fontWeight: "800" },

				legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14, justifyContent: "center" },
				legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
				legendDot: { width: 9, height: 9, borderRadius: 5 },
				legendLabel: { fontSize: 11, color: theme.textSecondary, textTransform: "capitalize" },
				legendPercent: { fontSize: 11, color: theme.textTertiary },

				pieCenter: { alignItems: "center" },
				pieCenterValue: { fontSize: 18, fontWeight: "800", color: theme.text },
				pieCenterLabel: { fontSize: 10, color: theme.textTertiary },

				chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
				chip: {
					paddingHorizontal: 12,
					paddingVertical: 6,
					borderRadius: 16,
					backgroundColor: theme.cardBgAlt,
					borderWidth: 1,
					borderColor: theme.border,
				},
				chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
				chipText: { fontSize: 11, fontWeight: "600", color: theme.textSecondary },
				chipTextActive: { color: theme.textInverse },

				weekRow: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					paddingVertical: 8,
					borderBottomWidth: 1,
					borderBottomColor: theme.border,
				},
				weekRowLabel: { fontSize: 13, color: theme.text, textTransform: "capitalize", fontWeight: "600" },
				weekRowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
				weekRowCount: { fontSize: 12, color: theme.textMuted },
				pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
				pillText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },

				chartLabel: { fontSize: 11, fontWeight: "700", color: theme.textMuted, marginBottom: 10 },
			}),
		[theme],
	);

	function openHistory(catalogId: number, name: string) {
		setHistoryModal({ visible: true, catalogId, name });
	}

	if (loading) {
		return (
			<SafeAreaView style={[styles.safe, { justifyContent: "center", alignItems: "center" }]}>
				<ActivityIndicator color={theme.primary} size="large" />
			</SafeAreaView>
		);
	}

	const chartWidth = Dimensions.get("window").width - 16 * 2 - 14 * 2;
	// Fall back to the first available curve whenever the explicit selection doesn't match any current
	// curve (e.g. right after a filter change) - derived at render time instead of synced via an effect.
	const effectiveFatigueCatalogId = data.fatigueCurves.some((c) => c.catalog_id === selectedFatigueCatalogId)
		? selectedFatigueCatalogId
		: (data.fatigueCurves[0]?.catalog_id ?? null);
	const selectedCurve = data.fatigueCurves.find((c) => c.catalog_id === effectiveFatigueCatalogId) ?? null;
	const latestWeek = data.weeklyLandmarks[data.weeklyLandmarks.length - 1] ?? null;
	const sortedRepRanges = REP_RANGE_ORDER.map(
		(range) => data.repRangeDistribution.find((b) => b.range === range) ?? { range, set_count: 0, percent: 0 },
	);

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => fetchAll(filter)}
						tintColor={theme.primary}
					/>
				}
			>
				<Text style={styles.pageTitle}>Progress</Text>

				<View style={styles.filterRow}>
					{FILTERS.map((f) => {
						const active = f.value === filter;
						return (
							<Pressable key={f.value} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setFilter(f.value)}>
								<Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{f.label}</Text>
							</Pressable>
						);
					})}
				</View>

				{/* Biggest Changes */}
				<ChartCard
					title="Biggest Changes"
					isEmpty={data.changes.length === 0}
					emptyIcon="chart-line"
					emptyTitle="No lift changes yet"
					emptySubtitle="Log the same exercise a couple times to see your biggest changes here"
				>
					{data.changes.map((c, i) => {
						const isIncrease = c.percent_change >= 0;
						const changeColor = isIncrease ? theme.macroProtein : theme.error;
						return (
							<Pressable
								key={c.catalog_id}
								style={[styles.row, i === data.changes.length - 1 && styles.rowLast]}
								onPress={() => openHistory(c.catalog_id, c.name)}
							>
								<View style={styles.iconWrap}>
									<FontAwesome5 name="dumbbell" size={15} color={theme.primary} />
								</View>
								<View style={{ flex: 1 }}>
									<Text style={styles.rowTitle}>{c.name}</Text>
									<Text style={styles.rowSubtitle}>{c.muscle_group}</Text>
									<View style={styles.rowValueLine}>
										<Text style={styles.rowValueText}>{Math.round(c.first_value)}</Text>
										<FontAwesome5 name="arrow-right" size={8} color={theme.textTertiary} />
										<Text style={styles.rowValueText}>{Math.round(c.last_value)}</Text>
										<Text style={styles.rowValueText}>
											({formatDate(c.first_date)} → {formatDate(c.last_date)})
										</Text>
									</View>
								</View>
								<View style={styles.percentWrap}>
									<FontAwesome5 name={isIncrease ? "arrow-up" : "arrow-down"} size={11} color={changeColor} />
									<Text style={[styles.percentText, { color: changeColor }]}>{Math.abs(c.percent_change).toFixed(1)}%</Text>
								</View>
							</Pressable>
						);
					})}
				</ChartCard>

				{/* Volume by Muscle Group */}
				<ChartCard
					title="Volume by Muscle Group"
					isEmpty={!data.volumeByMuscleGroup || data.volumeByMuscleGroup.total_volume === 0}
					emptyIcon="chart-pie"
					emptyTitle="No volume logged yet"
					emptySubtitle="Log some working sets to see how your volume splits across muscle groups"
				>
					{data.volumeByMuscleGroup && (
						<>
							<View style={{ alignItems: "center" }}>
								<PieChart
									data={data.volumeByMuscleGroup.breakdown.map((b) => ({
										value: b.volume,
										color: getMuscleGroupColor(b.muscle_group),
									}))}
									donut
									radius={72}
									innerRadius={46}
									innerCircleColor={theme.cardBg}
									centerLabelComponent={() => (
										<View style={styles.pieCenter}>
											<Text style={styles.pieCenterValue}>{data.volumeByMuscleGroup!.total_volume}</Text>
											<Text style={styles.pieCenterLabel}>total reps</Text>
										</View>
									)}
								/>
							</View>
							<View style={styles.legendRow}>
								{data.volumeByMuscleGroup.breakdown.map((b) => (
									<View key={b.muscle_group} style={styles.legendItem}>
										<View style={[styles.legendDot, { backgroundColor: getMuscleGroupColor(b.muscle_group) }]} />
										<Text style={styles.legendLabel}>{b.muscle_group.replace("_", " ")}</Text>
										<Text style={styles.legendPercent}>{Math.round(b.percent)}%</Text>
									</View>
								))}
							</View>
						</>
					)}
				</ChartCard>

				{/* Fatigue Curve */}
				<ChartCard
					title="Fatigue Curve"
					isEmpty={data.fatigueCurves.length === 0}
					emptyIcon="bolt"
					emptyTitle="No fatigue data yet"
					emptySubtitle="Log a few sessions with more than one exercise to see performance drop-off by position"
				>
					{data.fatigueCurves.length > 0 && (
						<>
							<ScrollView horizontal showsHorizontalScrollIndicator={false}>
								<View style={styles.chipRow}>
									{data.fatigueCurves.map((c) => {
										const active = c.catalog_id === effectiveFatigueCatalogId;
										return (
											<Pressable key={c.catalog_id} style={[styles.chip, active && styles.chipActive]} onPress={() => setSelectedFatigueCatalogId(c.catalog_id)}>
												<Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
											</Pressable>
										);
									})}
								</View>
							</ScrollView>
							{selectedCurve && (
								<LineChart
									data={selectedCurve.curve.map((p) => ({
										value: p.avg_percent_of_best,
										label: `#${p.order_number}`,
									}))}
									width={chartWidth}
									height={180}
									color={theme.primary}
									thickness={2.5}
									curved
									yAxisLabelSuffix="%"
									yAxisTextStyle={{ color: theme.textTertiary, fontSize: 10 }}
									xAxisLabelTextStyle={{ color: theme.textTertiary, fontSize: 10 }}
									xAxisColor={theme.border}
									yAxisColor={theme.border}
									rulesColor={theme.borderLight}
									noOfSections={4}
									initialSpacing={20}
									endSpacing={20}
								/>
							)}
						</>
					)}
				</ChartCard>

				{/* This Week's Volume Landmarks */}
				<ChartCard
					title="This Week's Volume"
					isEmpty={!latestWeek}
					emptyIcon="layer-group"
					emptyTitle="No sets logged this week"
					emptySubtitle="Log some working sets to see how your weekly volume stacks up per muscle group"
				>
					{latestWeek?.muscle_groups.map((mg, i) => (
						<View key={mg.muscle_group} style={[styles.weekRow, i === latestWeek.muscle_groups.length - 1 && styles.rowLast]}>
							<Text style={styles.weekRowLabel}>{mg.muscle_group.replace("_", " ")}</Text>
							<View style={styles.weekRowRight}>
								<Text style={styles.weekRowCount}>{mg.set_count} sets</Text>
								<View style={[styles.pill, { backgroundColor: classificationColor(mg.classification, theme) + "30" }]}>
									<Text style={[styles.pillText, { color: classificationColor(mg.classification, theme) }]}>{mg.classification}</Text>
								</View>
							</View>
						</View>
					))}
				</ChartCard>

				{/* Personal Records */}
				<ChartCard
					title="Personal Records"
					isEmpty={data.personalRecords.length === 0}
					emptyIcon="trophy"
					emptyTitle="No PRs yet"
					emptySubtitle="Beat a previous best e1RM on any lift to see it show up here"
				>
					{data.personalRecords.slice(0, 10).map((r, i) => (
						<Pressable
							key={`${r.catalog_id}-${r.workout_date}`}
							style={[styles.row, i === Math.min(data.personalRecords.length, 10) - 1 && styles.rowLast]}
							onPress={() => openHistory(r.catalog_id, r.name)}
						>
							<View style={styles.iconWrap}>
								<FontAwesome5 name="trophy" size={14} color={theme.macroFat} />
							</View>
							<View style={{ flex: 1 }}>
								<Text style={styles.rowTitle}>{r.name}</Text>
								<Text style={styles.rowSubtitle}>
									{r.muscle_group} • {formatDate(r.workout_date)}
								</Text>
							</View>
							<Text style={[styles.percentText, { color: theme.text }]}>{Math.round(r.value)}</Text>
						</Pressable>
					))}
				</ChartCard>

				{/* Training Frequency */}
				<ChartCard
					title="Training Frequency"
					isEmpty={data.trainingFrequency.length === 0}
					emptyIcon="calendar-check"
					emptyTitle="No sessions yet"
					emptySubtitle="Log a few workouts to see how many sessions you're logging per week"
				>
					<BarChart
						data={data.trainingFrequency.map((w) => ({
							value: w.session_count,
							label: formatDate(w.week_start),
							frontColor: theme.primary,
						}))}
						width={chartWidth}
						height={160}
						barWidth={22}
						spacing={18}
						barBorderRadius={4}
						noOfSections={4}
						yAxisTextStyle={{ color: theme.textTertiary, fontSize: 10 }}
						xAxisLabelTextStyle={{ color: theme.textTertiary, fontSize: 9 }}
						xAxisColor={theme.border}
						yAxisColor={theme.border}
						rulesColor={theme.borderLight}
					/>
				</ChartCard>

				{/* Session Trends */}
				<ChartCard
					title="Session Volume"
					isEmpty={data.sessionTrends.length === 0}
					emptyIcon="chart-area"
					emptyTitle="No session trends yet"
					emptySubtitle="Log a few weeks of sessions to see your average volume trend over time"
				>
					{data.sessionTrends.length > 0 && (
						<LineChart
							data={data.sessionTrends.map((w) => ({ value: w.avg_volume ?? 0, label: formatDate(w.week_start) }))}
							width={chartWidth}
							height={160}
							color={theme.macroCarbs}
							thickness={2.5}
							curved
							areaChart
							startFillColor={theme.macroCarbs}
							startOpacity={0.2}
							endOpacity={0.02}
							yAxisTextStyle={{ color: theme.textTertiary, fontSize: 10 }}
							xAxisLabelTextStyle={{ color: theme.textTertiary, fontSize: 9 }}
							xAxisColor={theme.border}
							yAxisColor={theme.border}
							rulesColor={theme.borderLight}
							noOfSections={4}
							initialSpacing={16}
							endSpacing={16}
						/>
					)}
				</ChartCard>

				<ChartCard
					title="Session Duration"
					isEmpty={data.sessionTrends.length === 0}
					emptyIcon="clock"
					emptyTitle="No session durations yet"
					emptySubtitle="Finish a few logged workouts to see your average session length trend"
				>
					{data.sessionTrends.length > 0 && (
						<LineChart
							data={data.sessionTrends.map((w) => ({ value: w.avg_duration_minutes ?? 0, label: formatDate(w.week_start) }))}
							width={chartWidth}
							height={160}
							color={theme.macroFat}
							thickness={2.5}
							curved
							yAxisLabelSuffix="m"
							yAxisTextStyle={{ color: theme.textTertiary, fontSize: 10 }}
							xAxisLabelTextStyle={{ color: theme.textTertiary, fontSize: 9 }}
							xAxisColor={theme.border}
							yAxisColor={theme.border}
							rulesColor={theme.borderLight}
							noOfSections={4}
							initialSpacing={16}
							endSpacing={16}
						/>
					)}
				</ChartCard>

				{/* Rep Range Distribution */}
				<ChartCard
					title="Rep Range Distribution"
					isEmpty={sortedRepRanges.every((b) => b.set_count === 0)}
					emptyIcon="sort-numeric-up"
					emptyTitle="No working sets yet"
					emptySubtitle="Log some working sets to see how your reps split across rep ranges"
				>
					<BarChart
						data={sortedRepRanges.map((b, i) => ({
							value: b.set_count,
							label: b.range,
							frontColor: [theme.macroProtein, theme.macroCarbs, theme.macroFat][i],
						}))}
						width={chartWidth}
						height={160}
						barWidth={40}
						spacing={30}
						barBorderRadius={4}
						noOfSections={4}
						yAxisTextStyle={{ color: theme.textTertiary, fontSize: 10 }}
						xAxisLabelTextStyle={{ color: theme.textSecondary, fontSize: 11, fontWeight: "700" }}
						xAxisColor={theme.border}
						yAxisColor={theme.border}
						rulesColor={theme.borderLight}
					/>
				</ChartCard>
			</ScrollView>

			<ExerciseHistoryModal
				visible={historyModal.visible}
				onClose={() => setHistoryModal((prev) => ({ ...prev, visible: false }))}
				catalogId={historyModal.catalogId}
				name={historyModal.name}
				filter={filter}
			/>
		</SafeAreaView>
	);
}
