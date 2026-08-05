import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useMemo, useState } from "react";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";

import RecipeDisplayCard, { type Recipe } from "./components/RecipeDisplayCard";

export default function Recipes() {
	const { theme } = useTheme();

	const [recipes, setRecipes] = useState<Recipe[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState(false);

	async function fetchRecipes() {
		try {
			setError(false);
			const res = await instance.get("/nutrition/recipes");
			setRecipes(res.data.recipes ?? res.data ?? []);
		} catch (e) {
			console.error("Recipes fetch error:", e);
			setError(true);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}

	useFocusEffect(
		useCallback(() => {
			fetchRecipes();
		}, []),
	);

	const styles = useMemo(
		() =>
			StyleSheet.create({
				safe: { flex: 1, backgroundColor: theme.background },
				header: {
					flexDirection: "row",
					alignItems: "center",
					paddingHorizontal: 16,
					paddingTop: 10,
					paddingBottom: 10,
					gap: 16,
				},
				backBtn: { padding: 4 },
				headerTitle: { color: theme.text, fontSize: 18, fontWeight: "700" },
				listContent: { paddingHorizontal: 16, paddingBottom: 40, flexGrow: 1 },
				center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
				emptyTitle: { color: theme.text, fontSize: 16, fontWeight: "700", marginTop: 12 },
				emptySubtitle: { color: theme.textMuted, fontSize: 13, marginTop: 4, textAlign: "center" },
				retryBtn: {
					marginTop: 16,
					backgroundColor: theme.primary,
					borderRadius: 8,
					paddingVertical: 8,
					paddingHorizontal: 16,
				},
				retryText: { color: theme.cardBg, fontWeight: "600" },
			}),
		[theme],
	);

	if (loading) {
		return (
			<SafeAreaView style={styles.safe} edges={["top"]}>
				<View style={styles.center}>
					<ActivityIndicator color={theme.primary} size="large" />
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<View style={styles.header}>
				<TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
					<FontAwesome5 name="arrow-left" size={18} color={theme.text} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>My Recipes</Text>
			</View>

			{error ? (
				<View style={styles.center}>
					<FontAwesome5 name="exclamation-circle" size={28} color={theme.textMuted} />
					<Text style={styles.emptyTitle}>Couldn't load recipes</Text>
					<TouchableOpacity style={styles.retryBtn} onPress={fetchRecipes}>
						<Text style={styles.retryText}>Retry</Text>
					</TouchableOpacity>
				</View>
			) : (
				<FlatList
					data={recipes}
					keyExtractor={(item) => String(item.id)}
					renderItem={({ item }) => <RecipeDisplayCard recipe={item} onPress={(recipe) => router.push(`/nutrition/CreateRecipe?recipe_id=${recipe.id}`)} />}
					contentContainerStyle={styles.listContent}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={() => {
								setRefreshing(true);
								fetchRecipes();
							}}
							tintColor={theme.primary}
						/>
					}
					ListEmptyComponent={
						<View style={styles.center}>
							<FontAwesome5 name="utensils" size={28} color={theme.textMuted} />
							<Text style={styles.emptyTitle}>No recipes yet</Text>
							<Text style={styles.emptySubtitle}>Recipes you create will show up here.</Text>
						</View>
					}
				/>
			)}
		</SafeAreaView>
	);
}
