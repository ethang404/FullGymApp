import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, AuthContext } from "@/utils/AuthProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { useContext } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import { AxiosInterceptorHandler } from "@/utils/AxiosInterceptorHandler";
import { ProfileProvider } from "@/utils/ProfileProvider";
import { ToastProvider } from "@/utils/ToastProvider";
import { useFonts } from "expo-font";
import { fontAssets } from "@/theme/typography";

function AppStack() {
	const { isValidUser, isLoading } = useContext(AuthContext);
	// A font that fails to load (fontError) shouldn't block the app; headings fall back to the system font.
	const [fontsLoaded, fontError] = useFonts(fontAssets);

	//need this while our verifyToken call is running
	//so we don't load the wrong stack off the rip. More of a cosmetic/performance thing than important functionality
	//may as well have
	if (isLoading || (!fontsLoaded && !fontError)) {
		return <LoadingScreen />;
	}

	return (
		<Stack>
			<Stack.Protected guard={!isValidUser}>
				<Stack.Screen name="login" options={{ headerShown: false }} />
			</Stack.Protected>

			<Stack.Protected guard={isValidUser}>
				<Stack.Screen name="(protected)" options={{ headerShown: false }} />
				<Stack.Screen name="onboarding" options={{ headerShown: false }} />
			</Stack.Protected>
		</Stack>
	);
}

export default function AppLayout() {
	return (
		//needed by anything using react-native-gesture-handler (e.g. drag-to-reorder in the workout editor)
		<GestureHandlerRootView style={{ flex: 1 }}>
			<ThemeProvider>
				{/* Every theme is dark, so status bar content is always light */}
				<StatusBar style="light" />
				<ToastProvider>
					<AuthProvider>
						<AxiosInterceptorHandler>
							<ProfileProvider>
								<AppStack />
							</ProfileProvider>
						</AxiosInterceptorHandler>
					</AuthProvider>
				</ToastProvider>
			</ThemeProvider>
		</GestureHandlerRootView>
	);
}
