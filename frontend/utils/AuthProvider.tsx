import React, { createContext, useState, type PropsWithChildren, useEffect, useCallback, useMemo } from "react";
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

	//We put these in a useCallback and a useMemo so we don't re-create these
	//functions (was created inline) like we were before
	//doing this prevents AxiosInterceptor to be re-created and us losing the instance for a second
	//this fixes a bug where we tore down interceptor value,
	//called an endpoint (didn't have auth token cause no inteceptor)
	//and errored.

	//now we have a valid instance all the time since signIn/signOut don't change
	const signIn = useCallback(() => setValidUser(true), []);
	const signOut = useCallback(() => setValidUser(false), []);

	const value = useMemo(() => ({ signIn, signOut, isValidUser, isLoading }), [signIn, signOut, isValidUser, isLoading]);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
