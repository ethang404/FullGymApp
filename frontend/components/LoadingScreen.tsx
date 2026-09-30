import React from "react";
import { View } from "react-native";
import LottieView from "lottie-react-native";
import walkingAvocado from "@/assets/animations/Walking_Avocado.lottie";

export default function LoadingScreen() {
	return (
		<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
			<LottieView source={walkingAvocado} autoPlay loop style={{ width: 200, height: 200 }} />
		</View>
	);
}
