import React, { createContext, useState, type PropsWithChildren, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { setOnAuthFailure, instance } from "./AuthAPI";
import { clearTokens, getAccessToken, loadTokens, saveTokens } from "./tokenHandler";

// What login/register/guest/google/apple send back
export type AuthTokens = { accessToken: string; refreshToken: string; isGuest?: boolean };

export const AuthContext = createContext<{
	signIn: (data: AuthTokens) => Promise<void>;
	signOut: () => void;
	isValidUser: boolean;
	isGuest: boolean;
	isLoading: boolean;
}>({
	signIn: async () => {},
	signOut: () => null,
	isValidUser: false,
	isGuest: false,
	isLoading: true,
});

export function AuthProvider({ children }: PropsWithChildren) {
	const [isValidUser, setValidUser] = useState(false);
	const [isGuest, setIsGuest] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	//Might use this later for offline stuff
	//look into a retry attempt for bad connection?
	//const [connectionError, setConnectionError] = useState(false); // server unreachable at launch

	// Runs at launch are the tokens we have saved still good?
	//   200          -> logged in
	//   401          -> logged out (instance already tried a refresh before giving us the 401)
	//   anything else -> server down / no connection: keep the tokens, block on the error screen
	const verifyToken = useCallback(async () => {
		setIsLoading(true);
		try {
			await loadTokens(); //load tokens into memory on startup
			if (!getAccessToken()) {
				setValidUser(false);
				return;
			}

			const resp = await instance.get("/auth/validToken");
			setValidUser(true);
			setIsGuest(Boolean(resp.data?.isGuest));
		} catch (err) {
			if (axios.isAxiosError(err) && err.response?.status === 401) {
				setValidUser(false);
				setIsGuest(false);
			}
		} finally {
			setIsLoading(false);
		}
	}, []);

	const signOut = useCallback(() => {
		setValidUser(false);
		setIsGuest(false);
		clearTokens().catch(() => {});
	}, []);

	const signIn = useCallback(async (data: AuthTokens) => {
		await saveTokens(data.accessToken, data.refreshToken);
		setValidUser(true);
		setIsGuest(Boolean(data.isGuest));
	}, []);

	//on mount define the setter from AuthAPI
	useEffect(() => {
		setOnAuthFailure(signOut);
	}, [signOut]);

	useEffect(() => {
		verifyToken();
	}, [verifyToken]);

	const value = useMemo(
		() => ({ signIn, signOut, verifyToken, isValidUser, isGuest, isLoading }),
		[signIn, signOut, verifyToken, isValidUser, isGuest, isLoading],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
