import { ReactNode } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";

interface ScreenProps {
	children: ReactNode;
	/**
	 * Insets to apply. Tab screens use ["top"] (the tab bar owns the bottom edge);
	 * stack screens with no tab bar use ["top", "bottom"].
	 */
	edges?: readonly Edge[];
	style?: StyleProp<ViewStyle>;
	/** Defaults to theme.background; pass theme.authBackground on auth screens. */
	background?: string;
}

// Shared screen wrapper: applies the device safe-area insets and a themed
// background so individual screens don't each re-implement <SafeAreaView> + a
// local styles.safe. Every screen in the app runs with headerShown: false, so
// this is the single place the top inset is handled.
export default function Screen({ children, edges = ["top"], style, background }: ScreenProps) {
	const { theme } = useTheme();
	return (
		<SafeAreaView style={[{ flex: 1, backgroundColor: background ?? theme.background }, style]} edges={edges}>
			{children}
		</SafeAreaView>
	);
}
