import React, { useContext } from "react";
import { View, Text, Button } from "react-native";
import { AuthContext } from "../utils/AuthProvider";

export default function hidden() {
	const { signOut, isValidUser } = useContext(AuthContext);

	return (
		<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
			<Text>{isValidUser ? "Already logged in!" : "Please log Out"}</Text>
			{isValidUser && <Button title="Log Out" onPress={signOut} />}
		</View>
	);
}
