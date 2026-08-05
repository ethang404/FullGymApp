import { Stack } from "expo-router";

//Create another stack here to handle navigation back and forth in the "nutrition context"
//by default go to nutrition page
export default function NutritionLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }} initialRouteName="Nutrition">
			<Stack.Screen name="Nutrition" />
			<Stack.Screen name="[food_id]" />
			<Stack.Screen name="CreateFood" />
			<Stack.Screen name="CreateRecipe" />
		</Stack>
	);
}
