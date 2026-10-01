import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, useWindowDimensions } from "react-native";
import { useMemo, useEffect, useRef, useState } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/typography";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import { toast } from "@/utils/toast";
import { formatShortDate } from "@/utils/date";
import { ChartCard } from "@/components/ChartCard";
import { ScreenState } from "@/components/ScreenState";
import FilterChips from "@/components/FilterChips";
import Screen from "@/components/Screen";
import { LiftProgressCard } from "@/features/progress/components/LiftProgressCard";
import { MuscleGroupSetsPie } from "@/features/progress/components/MuscleGroupSetsPie";
import { MuscleGroupVolumeBars } from "@/features/progress/components/MuscleGroupVolumeBars";
import { WEIGHT_UNIT, formatWeight, muscleLabel } from "@/features/progress/format";
import type { LiftChange, LoggedLift, ProgressFilter, VolumeByMuscleGroup } from "@/features/progress/types";

interface ProgressData {
	changes: LiftChange[];
	lifts: LoggedLift[];
	volume: VolumeByMuscleGroup | null;
}

const EMPTY_DATA: ProgressData = { changes: [], lifts: [], volume: null };

const FILTERS: readonly ProgressFilter[] = ["week", "month", "year", "all"];
const FILTER_LABELS: Record<ProgressFilter, string> = { week: "Week", month: "Month", year: "Year", all: "All time" };

const ENDPOINTS: { url: string; key: keyof ProgressData; extract: (body: any) => any }[] = [
	{ url: "/workouts/progress/biggest-changes", key: "changes", extract: (b) => b.changes ?? [] },
	{ url: "/workouts/progress/lifts", key: "lifts", extract: (b) => b.lifts ?? [] },
	{ url: "/workouts/progress/volume-by-muscle-group", key: "volume", extract: (b) => b ?? null },
];

const SCREEN_PADDING = 16;
const CARD_PADDING = 14;

export default function Progress() {
	const { theme } = useTheme();
	const { width: windowWidth } = useWindowDimensions();
	const [filter, setFilter] = useState<ProgressFilter>("month");
	const [data, setData] = useState<ProgressData>(EMPTY_DATA);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);
	const [error, setError] = useState(false);
	const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(null);

	const scrollRef = useRef<ScrollView>(null);
	const liftCardY = useRef(0);
	// Only the latest fetch may write state - tapping Month then Year quickly must not let the slower
	// Month response land last and show month data under the Year chip.
	const requestIdRef = useRef(0);

	async function fetchAll(currentFilter: ProgressFilter, isRefresh = false) {
		const requestId = ++requestIdRef.current;
		const results = await Promise.allSettled(ENDPOINTS.map((endpoint) => instance.get(endpoint.url, { params: { filter: currentFilter } })));
		if (requestIdRef.current !== requestId) return;

		setError(false);
		setData((prev) => {
			const next = { ...prev };
			results.forEach((res, i) => {
				const { key, extract } = ENDPOINTS[i];
				if (res.status === "fulfilled") {
					(next as any)[key] = extract(res.value.data);
				} else {
					log.error(`Progress fetch error (${key}):`, res.reason);
				}
			});
			return next;
		});

		// Every endpoint failed → surface it rather than showing empty charts.
		if (results.every((r) => r.status === "rejected")) {
			if (isRefresh) toast.error("Couldn't refresh. Pull down to try again.");
			else setError(true);
		}

		setLoading(false);
		setRefreshing(false);
	}

	useEffect(() => {
		fetchAll(filter);
	}, [filter]);

	const styles = useMemo(
		() =>
			StyleSheet.create({
				scroll: { flex: 1 },
				content: { padding: SCREEN_PADDING, paddingBottom: 32, gap: 20 },
				pageTitle: { fontSize: 28, lineHeight: 34, fontFamily: fonts.headingHeavy, color: theme.text },
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
				rowSubtitle: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
				rowValueLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
				rowValueText: { fontSize: 11, color: theme.textSecondary },
				percentWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
				percentText: { fontSize: 14, fontWeight: "800" },
				cardNote: { fontSize: 11, color: theme.textTertiary, marginTop: 10 },
			}),
		[theme],
	);

	const cardInnerWidth = windowWidth - SCREEN_PADDING * 2 - CARD_PADDING * 2;
	// Keep the lift picker on a lift that exists in the current range, falling back to the most-trained one
	// (derived at render time rather than synced through an effect).
	const effectiveCatalogId = data.lifts.some((l) => l.catalog_id === selectedCatalogId) ? selectedCatalogId : (data.lifts[0]?.catalog_id ?? null);
	const hasVolume = !!data.volume && data.volume.breakdown.length > 0;

	function showLift(catalogId: number) {
		setSelectedCatalogId(catalogId);
		scrollRef.current?.scrollTo({ y: Math.max(0, liftCardY.current - 12), animated: true });
	}

	return (
		<Screen edges={["top"]}>
			<ScreenState loading={loading} error={error} onRetry={() => fetchAll(filter)} errorTitle="Couldn't load your progress">
				<ScrollView
					ref={scrollRef}
					style={styles.scroll}
					contentContainerStyle={styles.content}
					showsVerticalScrollIndicator={false}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={() => {
								setRefreshing(true);
								setRefreshKey((k) => k + 1);
								fetchAll(filter, true);
							}}
							tintColor={theme.primary}
						/>
					}
				>
					<Text style={styles.pageTitle}>Progress</Text>

					<FilterChips options={FILTERS} value={filter} onSelect={setFilter} labels={FILTER_LABELS} />

					<ChartCard
						title="Biggest changes"
						isEmpty={data.changes.length === 0}
						emptyIcon="chart-line"
						emptyTitle="No lift changes yet"
						emptySubtitle="Log the same exercise a couple of times in this range to see how it's moved"
					>
						{data.changes.map((c, i) => {
							const isIncrease = c.percent_change >= 0;
							const changeColor = isIncrease ? theme.primary : theme.error;
							return (
								<Pressable
									key={c.catalog_id}
									style={[styles.row, i === data.changes.length - 1 && styles.rowLast]}
									onPress={() => showLift(c.catalog_id)}
									accessibilityRole="button"
									accessibilityHint="Shows this lift's chart"
								>
									<View style={styles.iconWrap}>
										<FontAwesome5 name="dumbbell" size={15} color={theme.primary} />
									</View>
									<View style={{ flex: 1 }}>
										<Text style={styles.rowTitle}>{c.name}</Text>
										<Text style={styles.rowSubtitle}>{muscleLabel(c.muscle_group)}</Text>
										<View style={styles.rowValueLine}>
											<Text style={styles.rowValueText}>{formatWeight(c.first_value)}</Text>
											<FontAwesome5 name="arrow-right" size={8} color={theme.textTertiary} />
											<Text style={styles.rowValueText}>
												{formatWeight(c.last_value)} {WEIGHT_UNIT} e1RM
											</Text>
											<Text style={styles.rowValueText}>
												({formatShortDate(c.first_date)} → {formatShortDate(c.last_date)})
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

					<View onLayout={(e) => (liftCardY.current = e.nativeEvent.layout.y)}>
						<ChartCard
							title="Lift progress"
							isEmpty={data.lifts.length === 0}
							emptyIcon="dumbbell"
							emptyTitle="No lifts logged yet"
							emptySubtitle="Log sets with weight and reps to chart each lift over time"
						>
							<LiftProgressCard
								lifts={data.lifts}
								selectedCatalogId={effectiveCatalogId}
								onSelectLift={setSelectedCatalogId}
								filter={filter}
								width={cardInnerWidth}
								refreshKey={refreshKey}
							/>
						</ChartCard>
					</View>

					<ChartCard
						title="Sets per muscle group"
						isEmpty={!hasVolume}
						emptyIcon="chart-pie"
						emptyTitle="No sets logged yet"
						emptySubtitle="Log some working sets to see which muscle groups you're training most"
					>
						{data.volume && <MuscleGroupSetsPie volume={data.volume} />}
					</ChartCard>

					<ChartCard
						title="Sets and reps per muscle group"
						isEmpty={!hasVolume}
						emptyIcon="chart-bar"
						emptyTitle="No sets logged yet"
						emptySubtitle="Log some working sets to compare sets and reps for each muscle group"
					>
						{data.volume && (
							<>
								<MuscleGroupVolumeBars volume={data.volume} width={cardInnerWidth} />
								<Text style={styles.cardNote}>Working sets only. Warm-ups aren&apos;t counted.</Text>
							</>
						)}
					</ChartCard>
				</ScrollView>
			</ScreenState>
		</Screen>
	);
}
