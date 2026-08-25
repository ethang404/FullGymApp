import { Stack } from "expo-router";
import { AuthProvider, AuthContext } from "@/utils/AuthProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { useContext } from "react";
import { ActivityIndicator, View } from "react-native";
import { AxiosInterceptorHandler } from "@/utils/AxiosInterceptorHandler";

function AppStack() {
	const { isValidUser, isLoading } = useContext(AuthContext);

	//need this while our verifyToken call is running
	//so we don't load the wrong stack off the rip. More of a cosmetic/performance thing than important functionality
	//may as well have
	if (isLoading) {
		return (
			<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
				<ActivityIndicator />
			</View>
		);
	}

	return (
		<Stack>
			<Stack.Protected guard={!isValidUser}>
				<Stack.Screen name="login" options={{ headerShown: false }} />
			</Stack.Protected>

			<Stack.Protected guard={isValidUser}>
				<Stack.Screen name="(protected)" options={{ headerShown: false }} />
			</Stack.Protected>
		</Stack>
	);
}

export default function AppLayout() {
	return (
		<ThemeProvider>
			<AuthProvider>
				<AxiosInterceptorHandler>
					<AppStack />
				</AxiosInterceptorHandler>
			</AuthProvider>
		</ThemeProvider>
	);
}

/*export default function AppLayout() {
	return (
		<Stack>
			<Stack.Screen name="login" />
			<Stack.Screen name="hidden" />
		</Stack>
	);
}*/
