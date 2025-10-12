import NavBar from "@/components/NavBar";
import { Stack, Tabs } from "expo-router";

//import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";

//We shouldn't be able to reach here unless we're authed. I think

//I'm going to make a dashboard that shows:
// if the user has a current workout going.
// Their total workout(s) on a day/week/month basis

//Metrics at a glance:
//shows improvement/otherwise

export default function AppLayout() {
	return (
		<Tabs>
			<Tabs.Screen name="Home" options={{ title: "Home" }} />
			<Tabs.Screen
				name="Profile"
				options={{
					title: "Profile",
					tabBarIcon: () => <FontAwesome5 name="dumbbell" size={24} color="black" />,
				}}
			/>
		</Tabs>
	);
}
