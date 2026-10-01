import { View, Text, StyleSheet } from "react-native";
import { useMemo } from "react";
import { PieChart } from "react-native-gifted-charts";
import { useTheme } from "@/theme/ThemeProvider";
import { getMuscleGroupColor } from "@/theme/chartColors";
import { muscleLabel } from "../format";
import type { VolumeByMuscleGroup } from "../types";

// Share of working sets per muscle group - sets are the usual unit for weekly training volume.
export function MuscleGroupSetsPie({ volume }: { volume: VolumeByMuscleGroup }) {
	const { theme } = useTheme();

	const styles = useMemo(
		() =>
			StyleSheet.create({
				center: { alignItems: "center" },
				centerValue: { fontSize: 20, fontWeight: "800", color: theme.text },
				centerLabel: { fontSize: 10, color: theme.textTertiary },
				legend: { marginTop: 16, gap: 8 },
				legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
				legendDot: { width: 10, height: 10, borderRadius: 5 },
				legendLabel: { flex: 1, fontSize: 13, color: theme.text },
				legendSets: { fontSize: 12, color: theme.textSecondary, fontWeight: "600" },
				legendPercent: { width: 40, textAlign: "right", fontSize: 12, color: theme.textTertiary },
			}),
		[theme],
	);

	return (
		<View>
			<View style={{ alignItems: "center" }}>
				<PieChart
					data={volume.breakdown.map((b) => ({ value: b.sets, color: getMuscleGroupColor(b.muscle_group) }))}
					donut
					radius={80}
					innerRadius={52}
					innerCircleColor={theme.cardBg}
					centerLabelComponent={() => (
						<View style={styles.center}>
							<Text style={styles.centerValue}>{volume.total_sets}</Text>
							<Text style={styles.centerLabel}>{volume.total_sets === 1 ? "set" : "sets"}</Text>
						</View>
					)}
				/>
			</View>
			<View style={styles.legend}>
				{volume.breakdown.map((b) => (
					<View key={b.muscle_group} style={styles.legendRow}>
						<View style={[styles.legendDot, { backgroundColor: getMuscleGroupColor(b.muscle_group) }]} />
						<Text style={styles.legendLabel}>{muscleLabel(b.muscle_group)}</Text>
						<Text style={styles.legendSets}>
							{b.sets} {b.sets === 1 ? "set" : "sets"}
						</Text>
						<Text style={styles.legendPercent}>{Math.round(b.percent_of_sets)}%</Text>
					</View>
				))}
			</View>
		</View>
	);
}
