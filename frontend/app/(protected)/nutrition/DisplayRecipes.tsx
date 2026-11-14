import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from "react-native";
import { useMemo } from "react";
import { router } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/typography";
import Screen from "@/components/Screen";

import RecipeDisplayCard from "@/features/nutrition/components/RecipeDisplayCard";
import { useRecipeList } from "@/features/nutrition/hooks/useRecipeList";

export default function Recipes() {
	const { theme } = useTheme();
	const list = useRecipeList();

	const styles = useMemo(
		() =>
			StyleSheet.create({
				header: {
					flexDirection: "row",
					alignItems: "center",
					paddingHorizontal: 16,
					paddingTop: 10,
					paddingBottom: 10,
					gap: 16,
				},
				backBtn: { padding: 4 },
				headerTitle: { color: theme.text, fontSize: 22, lineHeight: 28, fontFamily: fonts.heading },
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

	if (list.loading) {
		return (
			<Screen edges={["top", "bottom"]}>
				<View style={styles.center}>
					<ActivityIndicator color={theme.primary} size="large" />
				</View>
			</Screen>
		);
	}

	return (
		<Screen edges={["top", "bottom"]}>
			<View style={styles.header}>
				<TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
					<FontAwesome5 name="arrow-left" size={18} color={theme.text} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>My recipes</Text>
			</View>

			{list.error ? (
				<View style={styles.center}>
					<FontAwesome5 name="exclamation-circle" size={28} color={theme.textMuted} />
					<Text style={styles.emptyTitle}>Couldn&apos;t load recipes</Text>
					<TouchableOpacity style={styles.retryBtn} onPress={list.refetch}>
						<Text style={styles.retryText}>Retry</Text>
					</TouchableOpacity>
				</View>
			) : (
				<FlatList
					data={list.recipes}
					keyExtractor={(item) => String(item.id)}
					renderItem={({ item }) => <RecipeDisplayCard recipe={item} onPress={(recipe) => router.push(`/nutrition/CreateRecipe?recipe_id=${recipe.id}`)} />}
					contentContainerStyle={styles.listContent}
					refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={theme.primary} />}
					ListEmptyComponent={
						<View style={styles.center}>
							<FontAwesome5 name="utensils" size={28} color={theme.textMuted} />
							<Text style={styles.emptyTitle}>No recipes yet</Text>
							<Text style={styles.emptySubtitle}>Recipes you make or import will show up here.</Text>
						</View>
					}
				/>
			)}
		</Screen>
	);
}
