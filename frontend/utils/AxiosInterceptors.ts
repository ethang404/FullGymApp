import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { useContext } from "react";

//Define base URL:
const instance = axios.create({
	baseURL: process.env.EXPO_PUBLIC_BACKEND_URL,
});

instance.interceptors.request.use(async function (config) {
	//attach accessToken header
	const accessToken = await SecureStore.getItemAsync("accessToken");
	if (accessToken) {
		config.headers.Authorization = `Bearer ${accessToken}`;
	}
	return config;
});

instance.interceptors.response.use(
	async function (resp) {
		//successful
		return resp;
	},
	async function (error) {
		//Likely 401 error
		if (error.response.status === 401 || error.response.status === 400) {
			//call refresh token
			try {
				let refreshToken = await SecureStore.getItemAsync("refreshToken");
				let resp = await axios.get(`${process.env.EXPO_PUBLIC_BACKEND_URL}/auth/validToken`, {
					headers: {
						Authorization: `Bearer ${refreshToken}`,
						"Content-Type": "application/json",
					},
				});
				//try original request again
				let newToken = resp.data.accessToken;
				error.config.headers.Authorization = "Bearer " + newToken; //update header with new token

				return instance(error.config); //retry original request again

				//we would have an issue if the original request returns 401 I guess. I don't see that happening though
				//if it does, add a retry variable to the header and do a check to avoid trying to infinitely refresh token
			} catch (err) {
				//go to login page (call signout)
			}
		}
	}
);
