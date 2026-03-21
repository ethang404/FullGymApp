import { Tabs } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";

export default function AppLayout() {
	return (
		<Tabs>
			<Tabs.Screen
				name="Home"
				options={{
					title: "Home",
					headerShown: false,
					tabBarIcon: ({ color, size }) => <FontAwesome5 name="home" size={size} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="Workouts"
				options={{
					title: "Workouts",
					headerShown: false,
					tabBarIcon: ({ color, size }) => <FontAwesome5 name="dumbbell" size={size} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="Nutrition"
				options={{
					title: "Nutrition",
					headerShown: false,
					tabBarIcon: ({ color, size }) => <FontAwesome5 name="utensils" size={size} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="Profile"
				options={{
					title: "Profile",
					headerShown: false,
					tabBarIcon: ({ color, size }) => <FontAwesome5 name="user" size={size} color={color} />,
				}}
			/>

			<Tabs.Screen
				name="Progress"
				options={{
					title: "Progress",
					headerShown: false,
					tabBarIcon: ({ color, size }) => <FontAwesome5 name="chart-line" size={size} color={color} />,
				}}
			/>

			<Tabs.Screen
				name="workouts/[id]"
				options={{
					href: null, //need this to avoid showing in task bar by default. Weird expo router tab thing
				}}
			/>
		</Tabs>
	);
}
