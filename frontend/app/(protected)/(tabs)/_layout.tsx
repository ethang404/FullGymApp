import { Tabs } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";

export default function TabsLayout() {
	const { theme } = useTheme();

	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarStyle: {
					backgroundColor: theme.cardBg,
					borderTopColor: theme.border,
					borderTopWidth: 1,
					paddingBottom: 6,
					paddingTop: 6,
					height: 90,
				},
				tabBarActiveTintColor: theme.primary,
				tabBarInactiveTintColor: theme.textTertiary,
				tabBarLabelStyle: {
					fontSize: 12,
					fontWeight: "600",
				},
			}}
		>
			<Tabs.Screen
				name="Home"
				options={{
					title: "Today",
					tabBarIcon: ({ color, size }) => <FontAwesome5 name="sun" size={size - 2} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="nutrition"
				options={{
					title: "Food",
					tabBarIcon: ({ color, size }) => <FontAwesome5 name="utensils" size={size - 2} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="Workouts"
				options={{
					title: "Workouts",
					tabBarIcon: ({ color, size }) => <FontAwesome5 name="dumbbell" size={size - 2} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="Progress"
				options={{
					title: "Progress",
					tabBarIcon: ({ color, size }) => <FontAwesome5 name="chart-line" size={size - 2} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="Profile"
				options={{
					title: "You",
					tabBarIcon: ({ color, size }) => <FontAwesome5 name="user" size={size - 2} color={color} />,
				}}
			/>
			{/* Five tabs max. Friends and Explore live under You → Community (hidden from the bar, still tab routes). */}
			<Tabs.Screen name="Explore" options={{ href: null }} />
			<Tabs.Screen name="Friends" options={{ href: null }} />
		</Tabs>
	);
}
