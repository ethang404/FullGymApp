import React, { useContext, useEffect, useState } from "react";
import { View, Text, Button } from "react-native";
import { AuthContext } from "../utils/AuthProvider";
import axios from "axios";
import * as SecureStore from "expo-secure-store";

import { instance, authInstance } from "../utils/AxiosInterceptorHandler";

export default function Login() {
	const { signIn, isValidUser } = useContext(AuthContext);
	const [username, setUserName] = useState<string>();
	const [password, setPassword] = useState<string>();

	console.log("Login page");
	//apparently I can put all this login in Auth Provider!
	useEffect(() => {
		async function verifyToken() {
			const accessToken = await SecureStore.getItemAsync("accessToken");
			console.log("Do I have a token on login page render: ", accessToken);

			//I don't think I need try catch since it should handle that in the interceptor logic
			await instance.get("/auth/validToken");
			signIn();
		}
		verifyToken();
	}, []);

	async function login() {
		//Call backend /auth/login. If 200: set token and call signIn. Else display errors
		try {
			const loginPayload = {
				userName: "egor",
				password: "passy",
			};
			await authInstance.post("/auth/login", loginPayload);
		} catch (error) {
			//likely a wrong username/password
			//notify and update UI
		}
	}

	//Build login page
	return (
		<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
			<Text>{isValidUser ? "Already logged in!" : "Please log in"}</Text>
			{!isValidUser && <Button title="Log In" onPress={login} />}
		</View>
	);
}
