import { Tabs, Redirect, type Href } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { useProfile } from "@/utils/ProfileProvider";
import LoadingScreen from "@/components/LoadingScreen";

export default function ProtectedLayout() {
	const { theme } = useTheme();
	const { profile, loading } = useProfile();

	// Wait for the profile before deciding whether to send a first-time user
	// through onboarding — otherwise the tabs flash before the redirect.
	if (loading) {
		return <LoadingScreen />;
	}

	if (profile && !profile.onboarding_completed) {
		// cast: expo-router's typed-routes table is regenerated on `expo start`;
		// the /onboarding route exists at app/onboarding.tsx.
		return <Redirect href={"/onboarding" as Href} />;
	}

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
			<Tabs.Screen name="workouts/[workout_id]" options={{ href: null }} />
			<Tabs.Screen name="types/workouts" options={{ href: null }} />
			<Tabs.Screen name="types/nutrition" options={{ href: null }} />
			{/* 			<Tabs.Screen name="components/NutritionLabel" options={{ href: null }} />
			<Tabs.Screen name="components/RecipeFoodCard" options={{ href: null }} />
			<Tabs.Screen name="components/FoodCard" options={{ href: null }} />
			<Tabs.Screen name="components/RecipeDisplayCard" options={{ href: null }} /> */}
		</Tabs>
	);
}
