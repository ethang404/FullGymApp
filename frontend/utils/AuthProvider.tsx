import React, {
	createContext,
	useState,
	ReactNode,
	type PropsWithChildren,
	useEffect,
} from "react";
import axios from "axios";
import * as SecureStore from "expo-secure-store";

export const AuthContext = createContext<{
	signIn: () => void;
	signOut: () => void;
	isValidUser: boolean;
	isLoading: boolean;
}>({
	signIn: () => null,
	signOut: () => null,
	isValidUser: false,
	isLoading: true,
});

export function AuthProvider({ children }: PropsWithChildren) {
	const [isValidUser, setValidUser] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		async function verifyToken() {
			const accessToken = await SecureStore.getItemAsync("accessToken");
			if (!accessToken) {
				setValidUser(false);
				setIsLoading(false);
				return;
			}

			try {
				await axios.get(`${process.env.EXPO_PUBLIC_BACKEND_URL}/auth/validToken`, {
					headers: {
						Authorization: `Bearer ${accessToken}`,
					},
				});
				setValidUser(true);
			} catch {
				// token invalid or expired
				setValidUser(false);
			} finally {
				setIsLoading(false);
			}
		}
		verifyToken();
	}, []);

	return (
		<AuthContext.Provider
			value={{
				signIn: () => {
					// Perform sign-in logic here
					setValidUser(true);
				},
				signOut: () => {
					setValidUser(false);
				},
				isValidUser,
				isLoading,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}
