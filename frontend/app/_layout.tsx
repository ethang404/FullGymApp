import { Stack } from "expo-router";
import { AuthProvider, AuthContext } from "@/utils/AuthProvider";
import { useContext } from "react";
import { AxiosInterceptorHandler } from "@/utils/AxiosInterceptorHandler";

//import global navbar (if auth)
import NavBar from "@/components/NavBar";

//<Stack.Screen name="hidden" />

function AppStack() {
	const { isValidUser } = useContext(AuthContext);
	return (
		<Stack>
			<Stack.Protected guard={!isValidUser}>
				<Stack.Screen name="login" />
			</Stack.Protected>

			<Stack.Protected guard={isValidUser}>
				<Stack.Screen name="(protected)" options={{ headerShown: false }} />
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
