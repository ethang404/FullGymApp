import * as SecureStore from "expo-secure-store";
//this file only manages the tokens. Nothing else

//define this in memory for quicker access (not async)
let accessTokenCache: string | null = null;

//updates cache from memory on startup
export async function loadTokens() {
	accessTokenCache = await SecureStore.getItemAsync("accessToken");
}

export async function saveTokens(accessToken: string, refreshToken: string) {
	accessTokenCache = accessToken;
	await SecureStore.setItemAsync("accessToken", accessToken);
	await SecureStore.setItemAsync("refreshToken", refreshToken);
}

export async function clearTokens() {
	accessTokenCache = null;
	await SecureStore.deleteItemAsync("accessToken");
	await SecureStore.deleteItemAsync("refreshToken");
}

//The access getter in immediate, refresh is not (less used)
export function getAccessToken() {
	return accessTokenCache;
}

export function getRefreshToken() {
	return SecureStore.getItemAsync("refreshToken");
}
