import React, { useContext, useEffect, useState } from "react";
import { View, Text, Button } from "react-native";
import { AuthContext } from "../utils/AuthProvider";
import axios from "axios";
import * as SecureStore from "expo-secure-store";

export default function Login() {
	const { signIn, isValidUser } = useContext(AuthContext);
	const [username, setUserName] = useState<string>();
	const [password, setPassword] = useState<string>();

	console.log("Login page");

	//apparently I can put all this login in Auth Provider!
	useEffect(() => {
		async function verifyToken() {
			//get accessToken from expo secure store here--
			let authToken = await SecureStore.getItemAsync("accessToken");
			if (!authToken) return;

			let resp = await axios.get(`${process.env.EXPO_PUBLIC_BACKEND_URL}/auth/validToken`, {
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
					"Custom-Header": "My-Custom-Value",
				},
			});
			if (resp.status) {
				console.log("User is valid! YAY!");
				signIn();
			} else console.log("User is SUS!");
		}
		verifyToken();
	}, []);

	async function login() {
		//Call backend /auth/login. If 200: set token and call signIn. Else display errors
	}

	//Build login page
	return (
		<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
			<Text>{isValidUser ? "Already logged in!" : "Please log in"}</Text>
			{!isValidUser && <Button title="Log In" onPress={signIn} />}
		</View>
	);
}
