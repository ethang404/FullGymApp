import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { router, type Href } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";

// For screens that live off the tab bar (Friends, Explore). Always navigates to `to`
// rather than router.back(): tab "back" history can land on the first tab instead.
export function BackLink({ label, to }: { label: string; to: Href }) {
	const { theme } = useTheme();

	return (
		<TouchableOpacity
			style={styles.row}
			onPress={() => router.navigate(to)}
			hitSlop={12}
			accessibilityRole="button"
			accessibilityLabel={`Back to ${label}`}
		>
			<FontAwesome5 name="chevron-left" size={12} color={theme.primary} />
			<Text style={[styles.text, { color: theme.primary }]}>{label}</Text>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginBottom: 8, paddingVertical: 4 },
	text: { fontSize: 15, fontWeight: "600" },
});
