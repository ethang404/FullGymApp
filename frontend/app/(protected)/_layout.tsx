import { Stack, Redirect, type Href } from "expo-router";
import { useProfile } from "@/utils/ProfileProvider";
import LoadingScreen from "@/components/LoadingScreen";

export default function ProtectedLayout() {
	const { profile, loading } = useProfile();

	// Wait for the profile before deciding whether to send a first-time user
	// through onboarding , otherwise the tabs flash before the redirect.
	if (loading) {
		return <LoadingScreen />;
	}

	if (profile && !profile.onboarding_completed) {
		// cast: expo-router's typed-routes table is regenerated on `expo start`;
		// the /onboarding route exists at app/onboarding.tsx.
		return <Redirect href={"/onboarding" as Href} />;
	}

	// Detail screens live here, outside the (tabs) group, so navigating to them
	// from any tab pushes a real stack entry - back() then reliably returns to
	// whichever tab/screen opened them instead of following tab-switch history.
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="(tabs)" />
			<Stack.Screen name="workouts/[workout_id]" />
			<Stack.Screen name="friends/[friend_user_id]" />
			<Stack.Screen name="nutrition/CreateRecipe" />
			<Stack.Screen name="nutrition/DisplayRecipes" />
		</Stack>
	);
}
