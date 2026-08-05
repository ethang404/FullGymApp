import { Tabs } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";

export default function ProtectedLayout() {
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
					fontSize: 10,
					fontWeight: "600",
					letterSpacing: 0.5,
					textTransform: "uppercase",
				},
			}}
		>
			<Tabs.Screen
				name="Home"
				options={{
					title: "Dashboard",
					tabBarIcon: ({ color, size }) => <FontAwesome5 name="th-large" size={size - 2} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="nutrition"
				options={{
					title: "Nutrition",
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
					title: "Profile",
					tabBarIcon: ({ color, size }) => <FontAwesome5 name="user" size={size - 2} color={color} />,
				}}
			/>
			<Tabs.Screen name="workouts/[id]" options={{ href: null }} />
			{/* 			<Tabs.Screen name="components/NutritionLabel" options={{ href: null }} />
			<Tabs.Screen name="components/RecipeFoodCard" options={{ href: null }} />
			<Tabs.Screen name="components/FoodCard" options={{ href: null }} />
			<Tabs.Screen name="components/RecipeDisplayCard" options={{ href: null }} /> */}
		</Tabs>
	);
}
