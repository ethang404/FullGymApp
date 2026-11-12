import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { LineChart } from "react-native-gifted-charts";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AuthAPI";
import { log } from "@/utils/log";
import { formatMediumDate, formatShortDate } from "@/utils/date";
import FilterChips from "@/components/FilterChips";
import SegmentedControl from "@/components/SegmentedControl";
import { WeightRepsScatter } from "./WeightRepsScatter";
import { WEIGHT_UNIT, formatWeight, labelEvery, niceScale } from "../format";
import type { LiftHistory, LiftHistoryPoint, LoggedLift, ProgressFilter } from "../types";

type ChartMode = "e1rm" | "weight" | "weightReps";
const CHART_MODES: readonly ChartMode[] = ["e1rm", "weight", "weightReps"];
const MODE_LABELS: Record<ChartMode, string> = { e1rm: "e1RM", weight: "Weight", weightReps: "Weight vs reps" };

const MODE_CAPTIONS: Record<ChartMode, string> = {
	e1rm: `Estimated 1-rep max each workout (${WEIGHT_UNIT})`,
	weight: `Best set each workout (${WEIGHT_UNIT}), reps shown above each point`,
	weightReps: `Best set each workout (${WEIGHT_UNIT}), darker dots are more recent`,
};

const Y_AXIS_WIDTH = 36;
const CHART_HEIGHT = 200;

interface Props {
	lifts: LoggedLift[];
	selectedCatalogId: number | null;
	onSelectLift: (catalogId: number) => void;
	filter: ProgressFilter;
	width: number; // inner width of the card
	refreshKey: number; // bumped by pull-to-refresh so the chart refetches too
}

export function LiftProgressCard({ lifts, selectedCatalogId, onSelectLift, filter, width, refreshKey }: Props) {
	const { theme } = useTheme();
	const [mode, setMode] = useState<ChartMode>("e1rm");
	const [showE1rmInfo, setShowE1rmInfo] = useState(false);
	const [history, setHistory] = useState<LiftHistory | null>(null);
	// Which request `history` answers - it's loading whenever that isn't the current lift/filter/refresh.
	const [loadedKey, setLoadedKey] = useState<string | null>(null);
	const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
	// Only the most recent request may write state, so switching lifts quickly can't show a stale lift's chart.
	const requestIdRef = useRef(0);
	const requestKey = `${selectedCatalogId}-${filter}-${refreshKey}`;
	const loading = selectedCatalogId !== null && loadedKey !== requestKey;

	useEffect(() => {
		if (selectedCatalogId === null) return;
		const requestId = ++requestIdRef.current;
		instance
			.get(`/workouts/catalog/${selectedCatalogId}/history`, { params: { filter } })
			.then((res) => {
				if (requestIdRef.current !== requestId) return;
				setHistory(res.data ?? null);
				setSelectedPointIndex(null);
			})
			.catch((e) => {
				if (requestIdRef.current === requestId) setHistory(null);
				log.error("Lift history fetch error:", e);
			})
			.finally(() => {
				if (requestIdRef.current === requestId) setLoadedKey(requestKey);
			});
	}, [selectedCatalogId, filter, refreshKey, requestKey]);

	const styles = useMemo(
		() =>
			StyleSheet.create({
				liftChips: { marginBottom: 12 },
				captionRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, marginBottom: 10 },
				caption: { flex: 1, fontSize: 12, color: theme.textMuted },
				infoButton: { padding: 4 },
				infoBubble: {
					backgroundColor: theme.cardBgAlt,
					borderRadius: 12,
					borderWidth: 1,
					borderColor: theme.border,
					padding: 12,
					marginBottom: 12,
					gap: 6,
				},
				infoTitle: { fontSize: 13, fontWeight: "700", color: theme.text },
				infoText: { fontSize: 12, lineHeight: 17, color: theme.textSecondary },
				chartArea: { minHeight: CHART_HEIGHT + 40, justifyContent: "center" },
				emptyText: { fontSize: 13, color: theme.textTertiary, textAlign: "center" },
				detail: {
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
					marginTop: 12,
					paddingTop: 10,
					borderTopWidth: 1,
					borderTopColor: theme.border,
				},
				detailDate: { fontSize: 12, fontWeight: "700", color: theme.text },
				detailText: { fontSize: 12, color: theme.textSecondary, flexShrink: 1 },
				hint: { fontSize: 11, color: theme.textTertiary, marginTop: 6 },
			}),
		[theme],
	);

	const points = history?.catalog_id === selectedCatalogId ? (history?.data ?? []) : [];
	// Default to the latest workout so the detail row always says something useful.
	const activeIndex = points.length ? (selectedPointIndex !== null && selectedPointIndex < points.length ? selectedPointIndex : points.length - 1) : null;
	const activePoint = activeIndex !== null ? points[activeIndex] : null;

	const liftIds = useMemo(() => lifts.map((l) => String(l.catalog_id)), [lifts]);
	const liftLabels = useMemo(() => Object.fromEntries(lifts.map((l) => [String(l.catalog_id), l.name])), [lifts]);

	function renderLineChart() {
		const valueOf = (p: LiftHistoryPoint) => (mode === "e1rm" ? p.e1rm : p.weight);
		const values = points.map(valueOf);
		const scale = niceScale(Math.min(...values), Math.max(...values), 4);
		const plotWidth = width - Y_AXIS_WIDTH - 8;
		const sidePadding = 18;
		const spacing = points.length > 1 ? Math.max(36, (plotWidth - sidePadding * 2) / (points.length - 1)) : 0;
		const every = labelEvery(points.length, plotWidth);

		const data = points.map((p, i) => {
			const selected = i === activeIndex;
			return {
				value: valueOf(p),
				label: i % every === 0 || i === points.length - 1 ? formatShortDate(p.date) : "",
				dataPointColor: theme.primary,
				dataPointRadius: selected ? 6 : 4,
				...(mode === "weight" && {
					dataPointText: `×${p.reps}`,
					textColor: theme.textSecondary,
					textFontSize: 10,
					textShiftY: -8,
					textShiftX: -6,
				}),
			};
		});

		return (
			<LineChart
				data={data}
				width={plotWidth}
				height={CHART_HEIGHT}
				spacing={spacing}
				initialSpacing={sidePadding}
				endSpacing={sidePadding}
				yAxisOffset={scale.min}
				maxValue={scale.max - scale.min}
				stepValue={scale.step}
				noOfSections={scale.sections}
				yAxisLabelWidth={Y_AXIS_WIDTH}
				color={theme.primary}
				thickness={2.5}
				areaChart={mode === "e1rm"}
				startFillColor={theme.primary}
				startOpacity={0.2}
				endOpacity={0.02}
				onPress={(_item: unknown, index: number) => setSelectedPointIndex(index)}
				yAxisTextStyle={{ color: theme.textTertiary, fontSize: 10 }}
				xAxisLabelTextStyle={{ color: theme.textTertiary, fontSize: 9, width: 48 }}
				xAxisColor={theme.border}
				yAxisColor={theme.border}
				rulesColor={theme.borderLight}
			/>
		);
	}

	function renderChart() {
		if (loading && points.length === 0) return <ActivityIndicator color={theme.primary} />;
		if (points.length === 0) return <Text style={styles.emptyText}>No sets with weight and reps for this lift in this time range.</Text>;
		if (mode === "weightReps") {
			return <WeightRepsScatter points={points} width={width} selectedIndex={activeIndex} onSelect={setSelectedPointIndex} />;
		}
		return renderLineChart();
	}

	return (
		<View>
			<View style={styles.liftChips}>
				<FilterChips options={liftIds} value={String(selectedCatalogId)} onSelect={(id) => onSelectLift(Number(id))} labels={liftLabels} />
			</View>

			<SegmentedControl options={CHART_MODES} value={mode} onChange={setMode} labels={MODE_LABELS} />

			<View style={styles.captionRow}>
				<Text style={styles.caption}>{MODE_CAPTIONS[mode]}</Text>
				{mode === "e1rm" && (
					<Pressable
						style={styles.infoButton}
						onPress={() => setShowE1rmInfo((v) => !v)}
						hitSlop={8}
						accessibilityRole="button"
						accessibilityLabel="What is e1RM?"
					>
						<FontAwesome5 name="info-circle" size={15} color={showE1rmInfo ? theme.primary : theme.textTertiary} />
					</Pressable>
				)}
			</View>

			{mode === "e1rm" && showE1rmInfo && (
				<Pressable style={styles.infoBubble} onPress={() => setShowE1rmInfo(false)}>
					<Text style={styles.infoTitle}>What&apos;s e1RM?</Text>
					<Text style={styles.infoText}>
						Your estimated one-rep max: the most you could likely lift for a single rep. It&apos;s worked out from your best set each workout
						using weight × (1 + reps ÷ 30), so 80 {WEIGHT_UNIT} for 8 reps is about 101 {WEIGHT_UNIT}.
					</Text>
					<Text style={styles.infoText}>
						That puts heavy low-rep days and lighter high-rep days on the same scale, so you can see if you&apos;re getting stronger either way.
					</Text>
				</Pressable>
			)}

			<View style={styles.chartArea}>{renderChart()}</View>

			{activePoint && (
				<View style={styles.detail}>
					<Text style={styles.detailDate}>{formatMediumDate(activePoint.date)}</Text>
					<Text style={styles.detailText}>
						{formatWeight(activePoint.weight)} {WEIGHT_UNIT} × {activePoint.reps} reps · e1RM {formatWeight(activePoint.e1rm)} {WEIGHT_UNIT}
					</Text>
				</View>
			)}
			{points.length === 1 && <Text style={styles.hint}>Log this lift again to start seeing a trend.</Text>}
			{points.length > 1 && <Text style={styles.hint}>Tap a point to see that workout.</Text>}
		</View>
	);
}
