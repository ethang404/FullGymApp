import React, { useContext, useEffect, type PropsWithChildren } from "react";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { AuthContext } from "./AuthProvider";

export const instance = axios.create({
	baseURL: process.env.EXPO_PUBLIC_BACKEND_URL,
	headers: {
		"Content-Type": "application/json",
	},
});

export const authInstance = axios.create({
	baseURL: process.env.EXPO_PUBLIC_BACKEND_URL,
	headers: {
		"Content-Type": "application/json",
	},
});

export function AxiosInterceptorHandler({ children }: PropsWithChildren) {
	const { signOut, signIn } = useContext(AuthContext);

	useEffect(() => {
		console.log("AxiosInterceptorHandler mounted");
		return () => {
			console.log("AxiosInterceptorHandler unmounted");
		};
	}, []);

	useEffect(() => {
		console.log("UseEffect in axios area");
		const requestInterceptor = instance.interceptors.request.use(async (config) => {
			console.log("UseEffect in request interceptor area");
			const accessToken = await SecureStore.getItemAsync("accessToken");
			console.log("my token: ", accessToken);
			if (accessToken) {
				config.headers.Authorization = `Bearer ${accessToken}`;
				console.log("Attaching token");
			}
			return config;
		});

		const responseInterceptor = instance.interceptors.response.use(
			(resp) => resp,
			async (error) => {
				if (error.response?.status === 401 || error.response?.status === 400) {
					try {
						console.log("in response interceptor area-trying to refresh token");
						const refreshToken = await SecureStore.getItemAsync("refreshToken");
						const resp = await axios.get(`${process.env.EXPO_PUBLIC_BACKEND_URL}/auth/validToken`, {
							headers: {
								Authorization: `Bearer ${refreshToken}`,
								"Content-Type": "application/json",
							},
						});

						// update new token in storage if needed
						const newToken = resp.data.accessToken;
						await SecureStore.setItemAsync("accessToken", newToken);

						// update original request with new token
						error.config.headers.Authorization = `Bearer ${newToken}`;
						console.log("in response interceptor area-trying request with new token");
						// retry original request
						return instance(error.config);
					} catch (err) {
						console.log("in response interceptor area-Refresh failed");
						// Refresh failed: sign user out
						signOut();
						return Promise.reject(err);
					}
				}

				// Other errors
				return Promise.reject(error);
			}
		);

		const responseAuthInterceptor = authInstance.interceptors.response.use(
			async function loginRegister(resp) {
				console.log("In response Auth interceptor (passing)");
				if (resp.data?.refreshToken)
					await SecureStore.setItemAsync("refreshToken", resp.data.refreshToken);

				if (resp.data?.accessToken) {
					await SecureStore.setItemAsync("accessToken", resp.data.accessToken);
					signIn();
				}

				return resp;
			},
			function onFail(error) {
				console.log("In response Auth interceptor (FAILING)");
				//if user fails to login/register, simply return and let original call handle GUI updates accordingly
				return Promise.reject(error);
			}
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
