import React, { useContext, useEffect, type PropsWithChildren } from "react";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { AuthContext } from "./AuthProvider";
import { log } from "./log";

export const instance = axios.create({
	baseURL: process.env.EXPO_PUBLIC_BACKEND_URL,
	headers: {
		"Content-Type": "application/json",
	},
	timeout: 10000,
});

export const authInstance = axios.create({
	baseURL: process.env.EXPO_PUBLIC_BACKEND_URL,
	headers: {
		"Content-Type": "application/json",
	},
	timeout: 5000,
});

// Shared in-flight refresh promise so concurrent 401s only trigger ONE
// /auth/refresh call, instead of each failed request kicking off its own.
let refreshPromise: Promise<string> | null = null;

async function getRefreshedToken(): Promise<string> {
	if (!refreshPromise) {
		refreshPromise = (async () => {
			const refreshToken = await SecureStore.getItemAsync("refreshToken");
			if (!refreshToken) {
				throw new Error("No refresh token found");
			}

			const resp = await axios.post(`${process.env.EXPO_PUBLIC_BACKEND_URL}/auth/refresh`, { refreshToken });
			const newToken = resp.data.accessToken;
			await SecureStore.setItemAsync("accessToken", newToken);
			return newToken;
		})().finally(() => {
			refreshPromise = null;
		});
	}
	return refreshPromise;
}

export function AxiosInterceptorHandler({ children }: PropsWithChildren) {
	const { signOut, signIn } = useContext(AuthContext);

	useEffect(() => {
		const requestInterceptor = instance.interceptors.request.use(async (config) => {
			const accessToken = await SecureStore.getItemAsync("accessToken");
			if (accessToken) {
				config.headers.Authorization = `Bearer ${accessToken}`;
			}
			return config;
		});

		const responseInterceptor = instance.interceptors.response.use(
			(resp) => resp,
			async (error) => {
				const originalRequest = error.config;

				//Added retry guard to handle not calling the same request twice (don't spam retry)
				if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
					originalRequest._retry = true;

					try {
						const newToken = await getRefreshedToken();

						// update original request with new token
						originalRequest.headers.Authorization = `Bearer ${newToken}`;
						// retry original request
						return instance(originalRequest);
					} catch (err: any) {
						const status = err?.response?.status;
						//Specifically a auth error, sign out - refreshToken invalid
						if (status === 401) {
							signOut();
						} else {
							log.warn("Token refresh failed for a non-auth reason", err);
						}

						return Promise.reject(err);
					}
				}

				// Other error
				return Promise.reject(error);
			},
		);

		const responseAuthInterceptor = authInstance.interceptors.response.use(
			async function loginRegister(resp) {
				if (resp.data?.refreshToken) await SecureStore.setItemAsync("refreshToken", resp.data.refreshToken);

				if (resp.data?.accessToken) {
					await SecureStore.setItemAsync("accessToken", resp.data.accessToken);
					signIn();
				}

				return resp;
			},
			function onFail(error) {
				//if user fails to login/register, simply return and let original call handle GUI updates accordingly
				return Promise.reject(error);
			},
		);

		// Cleanup on unmount
		return () => {
			instance.interceptors.request.eject(requestInterceptor);
			instance.interceptors.response.eject(responseInterceptor);
			authInstance.interceptors.response.eject(responseAuthInterceptor);
		};
	}, [signOut, signIn]);

	return <>{children}</>;
}
