import React, { useContext } from "react";
import { View, Text, Button } from "react-native";
import { AuthContext } from "../utils/AuthProvider";
import * as SecureStore from "expo-secure-store";

export default function hidden() {
	const { signOut, isValidUser } = useContext(AuthContext);

	async function logOut() {
		//simply clear secure store and signout
		await SecureStore.deleteItemAsync("refreshToken");
		await SecureStore.deleteItemAsync("accessToken");
		signOut();
	}

	return (
		<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
			<Text>{isValidUser ? "Already logged in!" : "Please log Out"}</Text>
			{isValidUser && <Button title="Log Out" onPress={logOut} />}
		</View>
	);
}
