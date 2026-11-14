import { useMemo, type ReactNode } from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

// Building blocks shared by the onboarding cards, so they all have the same padding,
// corner radius and header layout.

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
	const { theme } = useTheme();
	return (
		<View
			style={[
				{
					backgroundColor: theme.cardBg,
					borderRadius: 16,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.border,
					padding: 16,
				},
				style,
			]}
		>
			{children}
		</View>
	);
}

export function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
	const { theme } = useTheme();
	const styles = useMemo(
		() =>
			StyleSheet.create({
				row: { flexDirection: "row", alignItems: "center", gap: 12 },
				text: { flex: 1 },
				title: { color: theme.text, fontSize: 15, fontWeight: "700" },
				subtitle: { color: theme.textMuted, fontSize: 13, marginTop: 2 },
			}),
		[theme],
	);

	return (
		<View style={styles.row}>
			<View style={styles.text}>
				<Text style={styles.title}>{title}</Text>
				{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
			</View>
			{right}
		</View>
	);
}

export function SectionLabel({ children }: { children: string }) {
	const { theme } = useTheme();
	return <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: "600", marginTop: 24, marginBottom: 10 }}>{children}</Text>;
}
