import { Text, View, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

export default function Profile() {
	const { theme, themeName, setTheme } = useTheme();
	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<Text style={[styles.title, { color: theme.text }]}>Profile</Text>
			<Text style={[styles.hint, { color: theme.textMuted }]}>Theme</Text>
			<View style={styles.toggleRow}>
				<TouchableOpacity
					style={[
						styles.toggleButton,
						{ backgroundColor: theme.cardBg, borderColor: theme.border },
						themeName === "light" && { backgroundColor: theme.primary },
					]}
					onPress={() => setTheme("light")}
				>
					<Text style={[styles.toggleText, { color: theme.textMuted }, themeName === "light" && { color: theme.textInverse }]}>Light</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={[
						styles.toggleButton,
						{ backgroundColor: theme.cardBg, borderColor: theme.border },
						themeName === "dark" && { backgroundColor: theme.primary },
					]}
					onPress={() => setTheme("dark")}
				>
					<Text style={[styles.toggleText, { color: theme.textMuted }, themeName === "dark" && { color: theme.textInverse }]}>Dark</Text>
				</TouchableOpacity>
			</View>
			<Text style={[styles.subtitle, { color: theme.text }]}>Edit PROFILE to edit this screen.</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 16,
	},
	title: {
		fontSize: 24,
		fontWeight: "700",
		marginBottom: 12,
	},
	hint: {
		fontSize: 14,
		marginBottom: 8,
	},
	toggleRow: {
		flexDirection: "row",
		gap: 12,
		marginBottom: 24,
	},
	toggleButton: {
		paddingVertical: 10,
		paddingHorizontal: 20,
		borderRadius: 12,
		borderWidth: 1,
	},
	toggleText: {
		fontSize: 14,
		fontWeight: "600",
	},
	subtitle: {
		fontSize: 14,
	},
});
