import { useMemo } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";

// "https://www.hungryhobby.net/x/" -> "hungryhobby.net" (RN's URL is spotty, so parse by hand)
function hostLabel(url: string | null): string {
	if (!url) return "Link";
	const m = url.match(/^https?:\/\/([^/]+)/i);
	return m ? m[1].replace(/^www\./, "") : "Link";
}

// The imported ingredient lines that weren't matched to a food yet. Tap one to search
// for it, ✕ to drop it, or Match to run the auto-matcher again.
export function ImportedIngredientsCard({
	lines,
	sourceUrl,
	autoMatching,
	onRetryMatch,
	onPressLine,
	onDismissLine,
}: {
	lines: string[];
	sourceUrl: string | null;
	autoMatching: boolean;
	onRetryMatch: () => void;
	onPressLine: (line: string) => void;
	onDismissLine: (line: string) => void;
}) {
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
				headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 4 },
				hint: { flex: 1, color: theme.textMuted, fontSize: 11, lineHeight: 15 },
				retryButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 2 },
				retryText: { color: theme.primary, fontSize: 11, fontWeight: "700" },
				row: {
					flexDirection: "row",
					alignItems: "center",
					gap: 10,
					paddingVertical: 10,
					borderTopWidth: StyleSheet.hairlineWidth,
					borderTopColor: theme.border,
				},
				lineText: { flex: 1, color: theme.text, fontSize: 18 },
			}),
		[theme],
	);

	return (
		<View style={styles.card}>
			<View style={styles.headerRow}>
				<Text style={styles.hint}>
					FROM {hostLabel(sourceUrl)} · {autoMatching ? "auto-matching…" : "tap an item to find and add the matching food, or dismiss it with ✕."}
				</Text>
				{!autoMatching && (
					<TouchableOpacity style={styles.retryButton} onPress={onRetryMatch}>
						<FontAwesome5 name="magic" size={10} color={theme.primary} />
						<Text style={styles.retryText}>Match</Text>
					</TouchableOpacity>
				)}
				{autoMatching && <ActivityIndicator size="small" color={theme.primary} />}
			</View>
			{lines.map((text, i) => (
				<View key={`${text}-${i}`} style={styles.row}>
					<FontAwesome5 name="search" size={20} color={theme.primary} />
					<Text style={styles.lineText} onPress={() => onPressLine(text)}>
						{text}
					</Text>
					<TouchableOpacity onPress={() => onDismissLine(text)} hitSlop={10}>
						<FontAwesome5 name="times" size={20} color={theme.textMuted} />
					</TouchableOpacity>
				</View>
			))}
		</View>
	);
}
