import React, { useContext } from "react";
import { Text, Button } from "react-native";
import { AuthContext } from "../utils/AuthProvider";
import Screen from "@/components/Screen";
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
		<Screen edges={["top", "bottom"]} style={{ justifyContent: "center", alignItems: "center" }}>
			<Text>{isValidUser ? "Already logged in!" : "Please log Out"}</Text>
			{isValidUser && <Button title="Log Out" onPress={logOut} />}
		</Screen>
	);
}
