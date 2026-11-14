//this file is axios interceptor logic that calls backend
//attaches token(s) and attempts refresh of tokens in case of 401

import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from "axios";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "./tokenHandler";

const baseURL = process.env.EXPO_PUBLIC_BACKEND_URL;

//instance handles everything except certain login things
//also used by verifyToken
export const instance = axios.create({
	baseURL,
	headers: {
		"Content-Type": "application/json",
	},
	timeout: 10000,
});

//This is used by:
//auth/login, /register, /guest, /google, /apple, /refresh
//attach nothing to this interceptor, everything is handled in body
export const authClient = axios.create({
	baseURL,
	headers: {
		"Content-Type": "application/json",
	},
	timeout: 10000,
}); // no interceptors -- no refresh loop

//This variable holds a function
//handles logout in case refresh token part fails
//gets defined when authProvider mounts and uses setOnAuthFailure to init
let onAuthFailure: (() => void) | null = null;

//setter we expose so our AuthProvider can import and define what onAuthFailure does
//onAuthFailure needs to happen but we don't care what it does
export function setOnAuthFailure(fn: (() => void) | null) {
	onAuthFailure = fn;
}

// Runs before every request: attach the access token
instance.interceptors.request.use((config) => {
	const token = getAccessToken();
	if (token) config.headers.Authorization = `Bearer ${token}`;
	return config;
});

//Handling the response, helper logic below
instance.interceptors.response.use(handleSuccess, handleError);

//Shared so that several 401s at once trigger only ONE refresh
//imagine multiple endpoints trigger when accessToken is bad
//and each one tries to auto refresh. They would overlap/race condition
//so if refreshPromise is not null we just wait for return from another call
//if it is null, go ahead and trigger a refresh
let refreshPromise: Promise<string> | null = null;

//refreshes access token, if it fails it clears the token
//by putting token clearing logic in here we can avoid multiple
//things hitting the catch and executing another clearTokens()--logs us out
async function refreshAccessToken(): Promise<string> {
	try {
		const refreshToken = await getRefreshToken();
		if (!refreshToken) throw new Error("No refresh token");

		const { data } = await authClient.post("/auth/refresh", { refreshToken });
		await saveTokens(data.accessToken, data.refreshToken ?? refreshToken);
		return data.accessToken;
	} catch (err) {
		// Logged out for real: no refresh token, or the server rejected it
		if (!axios.isAxiosError(err) || err.response?.status === 401) {
			await clearTokens();
			onAuthFailure?.();
		}
		throw err; // server down or 500: keep the tokens, just fail this request
	}
}

//AxiosConfig type + adding an optional retry parameter to the field
//marks if we've already retried it or not
type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

function handleSuccess(res: AxiosResponse) {
	return res;
}

async function handleError(error: AxiosError) {
	const original = error.config as RetryConfig | undefined;
	// Give up (don't refresh) if ANY of these are true:
	// - it's not a 401
	// - there's no request config to retry
	// - we already retried this request once
	if (error.response?.status !== 401 || !original || original._retry) throw error;

	original._retry = true;

	if (refreshPromise === null) {
		refreshPromise = refreshAccessToken().finally(() => {
			refreshPromise = null;
		});
	}
	const newToken = await refreshPromise;

	original.headers.Authorization = `Bearer ${newToken}`;
	return instance(original);
}
