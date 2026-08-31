import { View, Text, StyleSheet } from "react-native";
import { useMemo, type ReactNode, type ComponentProps } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";

type IconName = ComponentProps<typeof FontAwesome5>["name"];

interface ChartCardProps {
	title: string;
	isEmpty: boolean;
	emptyIcon: IconName;
	emptyTitle: string;
	emptySubtitle: string;
	children: ReactNode;
}

// Shared section wrapper for the Progress screen: a section label + card
// container, matching the visual language of the original "Biggest Changes"
// section, with a consistent empty state so a section with no data yet
// (e.g. a brand new user) never renders blank or crashes on empty arrays.
export function ChartCard({ title, isEmpty, emptyIcon, emptyTitle, emptySubtitle, children }: ChartCardProps) {
	const { theme } = useTheme();

	const styles = useMemo(
		() =>
			StyleSheet.create({
				wrap: { marginTop: 4 },
				sectionLabel: {
					fontSize: 11,
					fontWeight: "700",
					color: theme.textMuted,
					letterSpacing: 1.5,
					textTransform: "uppercase",
					marginBottom: 8,
				},
				card: {
					backgroundColor: theme.cardBg,
					borderRadius: 14,
					padding: 14,
					borderWidth: 1,
					borderColor: theme.border,
				},
				emptyState: {
					alignItems: "center",
					paddingVertical: 24,
					gap: 8,
				},
				emptyTitle: {
					fontSize: 14,
					fontWeight: "700",
					color: theme.textMuted,
				},
				emptySubtitle: {
					fontSize: 12,
					color: theme.textTertiary,
					textAlign: "center",
				},
			}),
		[theme],
	);

	return (
		<View style={styles.wrap}>
			<Text style={styles.sectionLabel}>{title}</Text>
			<View style={styles.card}>
				{isEmpty ? (
					<View style={styles.emptyState}>
						<FontAwesome5 name={emptyIcon} size={26} color={theme.textTertiary} />
						<Text style={styles.emptyTitle}>{emptyTitle}</Text>
						<Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
					</View>
				) : (
					children
				)}
			</View>
		</View>
	);
}
