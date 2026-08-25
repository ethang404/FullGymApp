import { Redirect } from "expo-router";
import { useContext } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthContext } from "@/utils/AuthProvider";

//apparently needed to be explicit for build so it knows where to go by default
export default function Index() {
	const { isValidUser, isLoading } = useContext(AuthContext);

	//We use this to return before the bool isValidUser check
	//so we have time to verify token before navigating one way or another
	if (isLoading) {
		return (
			<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
				<ActivityIndicator />
			</View>
		);
	}

	return <Redirect href={isValidUser ? "/(protected)/Home" : "/login"} />;
}
