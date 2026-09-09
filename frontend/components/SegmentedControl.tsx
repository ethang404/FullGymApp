import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useMemo } from "react";
import { useTheme } from "@/theme/ThemeProvider";

// A single-select segmented control (iOS-style pill row). Generic over a string
// union so callers get autocomplete on `value`/`onChange`. Used for the tab
// switcher in LogFoodModal.
export default function SegmentedControl<T extends string>({
	options,
	value,
	onChange,
	labels,
}: {
	options: readonly T[];
	value: T;
	onChange: (v: T) => void;
	labels?: Record<string, string>;
}) {
	const { theme } = useTheme();

	const styles = useMemo(
		() =>
			StyleSheet.create({
				track: {
					flexDirection: "row",
					backgroundColor: theme.cardBgAlt,
					borderRadius: 12,
					padding: 3,
					gap: 3,
				},
				segment: {
					flex: 1,
					paddingVertical: 8,
					borderRadius: 9,
					alignItems: "center",
					justifyContent: "center",
				},
				segmentActive: {
					backgroundColor: theme.primary,
				},
				label: {
					fontSize: 13,
					fontWeight: "600",
					color: theme.textMuted,
				},
				labelActive: {
					color: theme.textInverse,
					fontWeight: "700",
				},
			}),
		[theme],
	);

	return (
		<View style={styles.track}>
			{options.map((opt) => {
				const active = opt === value;
				return (
					<TouchableOpacity
						key={opt}
						style={[styles.segment, active && styles.segmentActive]}
						onPress={() => onChange(opt)}
						activeOpacity={0.8}
					>
						<Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
							{labels?.[opt] ?? opt}
						</Text>
					</TouchableOpacity>
				);
			})}
		</View>
	);
}
