import React, {
	createContext,
	useState,
	type PropsWithChildren,
	useEffect,
	useCallback,
	useMemo,
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

	// Stable identities so downstream effects that depend on these (e.g. the axios
	// interceptor setup) don't tear down and rebuild every time auth state changes.
	// Rebuilding the interceptors on sign-in opens a window where an in-flight
	// request (like the initial profile fetch) goes out with no Authorization header.
	const signIn = useCallback(() => setValidUser(true), []);
	const signOut = useCallback(() => setValidUser(false), []);

	const value = useMemo(
		() => ({ signIn, signOut, isValidUser, isLoading }),
		[signIn, signOut, isValidUser, isLoading],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
