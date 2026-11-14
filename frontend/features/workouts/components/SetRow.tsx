import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/theme/ThemeProvider";
import type { PreviousSet, WorkoutSet } from "../types";
import { formatNumber } from "../utils/workoutEditor";
import { DragGrip } from "./DragGrip";
import { NumberField } from "./NumberField";
import { SetTypePicker } from "./SetTypePicker";

//column widths shared by the header row (SetsTable) and every set row so they line up
export const SET_COLUMNS = { grip: 24, type: 56, lbs: 60, reps: 52, rir: 48, trash: 28 };

//One row of the sets table
export function SetRow({
	set,
	label,
	previous,
	onChange,
	onRemove,
}: {
	set: WorkoutSet;
	label: string; // "W", "1", "2"...
	previous: PreviousSet | null; // the matching set from last time, if any
	onChange: (patch: Partial<WorkoutSet>) => void;
	onRemove: () => void;
}) {
	const { theme } = useTheme();
	const styles = useMemo(
		() =>
			StyleSheet.create({
				row: {
					flexDirection: "row",
					alignItems: "center",
					minHeight: 48,
					paddingHorizontal: 8,
					borderRadius: 14,
					borderWidth: 1,
					borderColor: theme.borderLight,
					backgroundColor: theme.cardBg,
				},
				typeCell: { flexDirection: "row", alignItems: "center", gap: 6 },
				prevText: { fontSize: 14, color: theme.textMuted },
				input: {
					marginHorizontal: 3,
					height: 34,
					borderRadius: 8,
					borderWidth: 1,
					borderColor: theme.inputBorder,
					backgroundColor: theme.inputBg,
					color: theme.text,
					fontSize: 15,
					fontWeight: "700",
					textAlign: "center",
					paddingVertical: 0,
				},
				rirInput: { borderColor: theme.primary, color: theme.primary },
			}),
		[theme],
	);

	return (
		<View style={styles.row}>
			<View style={{ width: SET_COLUMNS.grip }}>
				<DragGrip label={`Drag set ${label} to reorder`} />
			</View>

			<View style={[styles.typeCell, { width: SET_COLUMNS.type }]}>
				<SetTypePicker label={label} value={set.set_type} onChange={(set_type) => onChange({ set_type })} />
			</View>

			<Text style={[styles.prevText, { flex: 1 }]} numberOfLines={1}>
				{previous ? `${formatNumber(previous.weight)} × ${formatNumber(previous.reps)}` : "–"}
			</Text>

			{/* text boxes with last time's numbers as placeholders */}
			<View style={{ width: SET_COLUMNS.lbs }}>
				<NumberField value={set.weight} onChangeValue={(weight) => onChange({ weight })} placeholder={previous?.weight?.toString()} decimal style={styles.input} />
			</View>
			<View style={{ width: SET_COLUMNS.reps }}>
				<NumberField value={set.reps} onChangeValue={(reps) => onChange({ reps })} placeholder={previous?.reps?.toString()} style={styles.input} />
			</View>
			<View style={{ width: SET_COLUMNS.rir }}>
				<NumberField
					value={set.reps_in_reserve}
					onChangeValue={(reps_in_reserve) => onChange({ reps_in_reserve })}
					placeholder={previous?.reps_in_reserve?.toString()}
					style={[styles.input, styles.rirInput]}
				/>
			</View>

			<View style={{ width: SET_COLUMNS.trash, alignItems: "center" }}>
				<Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove set ${label}`}>
					<Ionicons name="trash-outline" size={18} color={theme.textTertiary} />
				</Pressable>
			</View>
		</View>
	);
}
