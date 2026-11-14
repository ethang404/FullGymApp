import { View, Text, StyleSheet } from "react-native";
import { useMemo } from "react";
import { BarChart } from "react-native-gifted-charts";
import { useTheme } from "@/theme/ThemeProvider";
import { muscleLabel, niceZeroBasedMax } from "../format";
import type { VolumeByMuscleGroup } from "../types";

// Sets and reps side by side for each muscle group. Reps run ~10x sets, so reps get their own y-axis on the
// right - otherwise every sets bar would be a sliver. Both axes use the same number of sections so their
// gridlines line up.

const SECTIONS = 4;
const BAR_WIDTH = 14;
const PAIR_GAP = 3; // between a group's sets and reps bars
const GROUP_GAP = 24; // between muscle groups
const AXIS_WIDTH = 32;

export function MuscleGroupVolumeBars({ volume, width }: { volume: VolumeByMuscleGroup; width: number }) {
	const { theme } = useTheme();
	const setsColor = theme.primary;
	const repsColor = theme.macroCarbs;

	const styles = useMemo(
		() =>
			StyleSheet.create({
				legend: { flexDirection: "row", justifyContent: "center", gap: 18, marginBottom: 12 },
				legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
				legendSwatch: { width: 10, height: 10, borderRadius: 3 },
				legendLabel: { fontSize: 12, color: theme.textSecondary },
				topLabel: { fontSize: 9, color: theme.textMuted, textAlign: "center" },
			}),
		[theme],
	);

	const maxSets = Math.max(...volume.breakdown.map((b) => b.sets));
	const maxReps = Math.max(...volume.breakdown.map((b) => b.reps));
	const setsAxisMax = niceZeroBasedMax(maxSets, SECTIONS);
	const repsAxisMax = niceZeroBasedMax(maxReps, SECTIONS);

	const topLabel = (value: number) =>
		function TopLabel() {
			return <Text style={styles.topLabel}>{value}</Text>;
		};

	const data = volume.breakdown.flatMap((b) => [
		{
			value: b.sets,
			frontColor: setsColor,
			spacing: PAIR_GAP,
			label: muscleLabel(b.muscle_group),
			labelWidth: BAR_WIDTH * 2 + PAIR_GAP + GROUP_GAP - 4,
			labelTextStyle: { color: theme.textSecondary, fontSize: 10 },
			topLabelComponent: topLabel(b.sets),
		},
		{
			value: b.reps,
			frontColor: repsColor,
			isSecondary: true,
			spacing: GROUP_GAP,
			topLabelComponent: topLabel(b.reps),
		},
	]);

	return (
		<View>
			<View style={styles.legend}>
				<View style={styles.legendItem}>
					<View style={[styles.legendSwatch, { backgroundColor: setsColor }]} />
					<Text style={styles.legendLabel}>Sets (left)</Text>
				</View>
				<View style={styles.legendItem}>
					<View style={[styles.legendSwatch, { backgroundColor: repsColor }]} />
					<Text style={styles.legendLabel}>Reps (right)</Text>
				</View>
			</View>
			<BarChart
				data={data}
				width={width - AXIS_WIDTH * 2 - 8}
				height={180}
				barWidth={BAR_WIDTH}
				initialSpacing={12}
				endSpacing={8}
				barBorderRadius={3}
				noOfSections={SECTIONS}
				maxValue={setsAxisMax}
				yAxisLabelWidth={AXIS_WIDTH}
				yAxisTextStyle={{ color: setsColor, fontSize: 10 }}
				secondaryYAxis={{
					maxValue: repsAxisMax,
					noOfSections: SECTIONS,
					yAxisLabelWidth: AXIS_WIDTH,
					yAxisColor: theme.border,
					yAxisTextStyle: { color: repsColor, fontSize: 10 },
				}}
				xAxisColor={theme.border}
				yAxisColor={theme.border}
				rulesColor={theme.borderLight}
				labelsExtraHeight={4}
			/>
		</View>
	);
}
