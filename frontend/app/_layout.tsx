import { Stack } from "expo-router";
import { AuthProvider, AuthContext } from "@/utils/AuthProvider";
import { useContext } from "react";
import { AxiosInterceptorHandler } from "@/utils/AxiosInterceptorHandler";

function AppStack() {
	const { isValidUser } = useContext(AuthContext);
	return (
		<Stack>
			<Stack.Protected guard={!isValidUser}>
				<Stack.Screen name="login" />
			</Stack.Protected>

			<Stack.Protected guard={isValidUser}>
				<Stack.Screen name="hidden" />
			</Stack.Protected>
		</Stack>
	);
}

export default function AppLayout() {
	return (
		<AuthProvider>
			<AxiosInterceptorHandler>
				<AppStack />
			</AxiosInterceptorHandler>
		</AuthProvider>
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
