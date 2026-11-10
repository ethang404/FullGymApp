import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

// The method steps from a recipe imported from a link (shown for reference, not saved).
export function ImportedStepsCard({ steps }: { steps: string[] }) {
	const { theme } = useTheme();
	const styles = useMemo(
		() =>
			StyleSheet.create({
				card: {
					backgroundColor: theme.cardBg,
					borderRadius: 14,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.border,
					padding: 14,
					marginBottom: 20,
				},
				title: { color: theme.textSecondary, fontSize: 14, fontWeight: "700", marginBottom: 8 },
				step: { color: theme.textMuted, fontSize: 12, lineHeight: 17, marginTop: 6 },
			}),
		[theme],
	);

	return (
		<View style={styles.card}>
			<Text style={styles.title}>IMPORTED STEPS ({String(steps.length).padStart(2, "0")})</Text>
			{steps.map((step, i) => (
				<Text key={i} style={styles.step}>
					{i + 1}. {step}
				</Text>
			))}
		</View>
	);
}
