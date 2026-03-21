import { Text, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

export default function Progress() {
	const { theme } = useTheme();
	return (
		<View
			style={{
				flex: 1,
				justifyContent: "center",
				alignItems: "center",
				backgroundColor: theme.background,
			}}
		>
			<Text style={{ color: theme.text }}>Edit Progress to edit this screen.</Text>
		</View>
	);
}
