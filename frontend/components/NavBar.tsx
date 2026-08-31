import React from "react";
import { View, Text } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";

export default function NavVar() {
	const { theme } = useTheme();
	return (
		<SafeAreaProvider>
			<SafeAreaView style={{ height: 100, flexDirection: "row" }}>
				<View style={{ backgroundColor: theme.primary, flex: 0.2 }} />
				<View style={{ backgroundColor: theme.accent, flex: 0.4 }} />
				<Text style={{ color: theme.text }}>Hello World!</Text>
			</SafeAreaView>
		</SafeAreaProvider>
	);
}
