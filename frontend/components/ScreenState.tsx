import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useMemo, type ComponentProps, type ReactNode } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";

type IconName = ComponentProps<typeof FontAwesome5>["name"];

interface ScreenStateProps {
	loading?: boolean;
	error?: boolean;
	onRetry?: () => void;
	errorTitle?: string;
	errorSubtitle?: string;
	empty?: boolean;
	emptyIcon?: IconName;
	emptyTitle?: string;
	emptySubtitle?: string;
	children: ReactNode;
}

// Full-bleed loading / error / empty state for a screen's main content area, so
// "the request failed" is never mistaken for "you have nothing yet". Visual
// language matches ChartCard and the hand-rolled state in DisplayRecipes.
export function ScreenState({
	loading,
	error,
	onRetry,
	errorTitle = "Something went wrong",
	errorSubtitle = "Check your connection and try again.",
	empty,
	emptyIcon = "inbox",
	emptyTitle = "Nothing here yet",
	emptySubtitle,
	children,
}: ScreenStateProps) {
	const { theme } = useTheme();

	const styles = useMemo(
		() =>
			StyleSheet.create({
				center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32, gap: 10 },
				title: { color: theme.text, fontSize: 16, fontWeight: "700", textAlign: "center" },
				subtitle: { color: theme.textMuted, fontSize: 13, textAlign: "center" },
				retryBtn: {
					marginTop: 8,
					backgroundColor: theme.primary,
					borderRadius: 10,
					paddingVertical: 10,
					paddingHorizontal: 22,
				},
				retryText: { color: theme.textInverse, fontWeight: "700", fontSize: 14 },
			}),
		[theme],
	);

	if (loading) {
		return (
			<View style={styles.center}>
				<ActivityIndicator color={theme.primary} size="large" />
			</View>
		);
	}

	if (error) {
		return (
			<View style={styles.center}>
				<FontAwesome5 name="exclamation-circle" size={28} color={theme.textMuted} />
				<Text style={styles.title}>{errorTitle}</Text>
				<Text style={styles.subtitle}>{errorSubtitle}</Text>
				{onRetry && (
					<TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.85}>
						<Text style={styles.retryText}>Retry</Text>
					</TouchableOpacity>
				)}
			</View>
		);
	}

	if (empty) {
		return (
			<View style={styles.center}>
				<FontAwesome5 name={emptyIcon} size={26} color={theme.textTertiary} />
				<Text style={styles.title}>{emptyTitle}</Text>
				{emptySubtitle ? <Text style={styles.subtitle}>{emptySubtitle}</Text> : null}
			</View>
		);
	}

	return <>{children}</>;
}
