import { Stack } from "expo-router";
import { AuthProvider, AuthContext } from "@/utils/AuthProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { useContext } from "react";
import { AxiosInterceptorHandler } from "@/utils/AxiosInterceptorHandler";

function AppStack() {
	const { isValidUser } = useContext(AuthContext);
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
