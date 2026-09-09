import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMemo, useState } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { router } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/colors"; //for typing

import SegmentedControl from "@/components/SegmentedControl";
import FoodCard from "./components/FoodCard";
import RecipeLogCard from "./components/RecipeLogCard";
import { useFoodSearch } from "./hooks/useFoodSearch";
import { useRecipes, useRecentLogged } from "./hooks/useRecentLogged";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

type Tab = "foods" | "recipes" | "recent";
const TABS: readonly Tab[] = ["foods", "recipes", "recent"] as const;
const TAB_LABELS: Record<Tab, string> = { foods: "Foods", recipes: "Recipes", recent: "Recent" };
const SEARCH_PLACEHOLDER: Record<Tab, string> = {
	foods: "Search for a food...",
	recipes: "Search your recipes...",
	recent: "Filter recent items...",
};

interface LogFoodModalProps {
	visible: boolean;
	mealType: MealType;
	selectedDate: string;
	onClose: () => void; //do nothing
	onLogged: () => void; //should call to update diary entries
}

export default function LogFoodModal({ visible, mealType, selectedDate, onClose, onLogged }: LogFoodModalProps) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();

	const [tab, setTab] = useState<Tab>("foods");

	// Foods tab: debounced API search. Recipes/Recent: fetched once per open,
	// filtered client-side by the same `query`.
	const { query, setQuery, results: foodResults, loading: foodsLoading } = useFoodSearch();
	const { recipes, loading: recipesLoading, error: recipesError, refetch: refetchRecipes } = useRecipes(visible);
	const { items: recentItems, loading: recentLoading, error: recentError, refetch: refetchRecent } = useRecentLogged(visible);

	const needle = query.trim().toLowerCase();

	const recipeMatches = useMemo(
		() => (needle ? recipes.filter((r) => r.name.toLowerCase().includes(needle)) : recipes),
		[recipes, needle],
	);

	const recentMatches = useMemo(() => {
		if (!needle) return recentItems;
		return recentItems.filter((it) => {
			const name = it.type === "food" ? it.food.name : it.recipe.name;
			return name.toLowerCase().includes(needle);
		});
	}, [recentItems, needle]);

	function handleLogged() {
		onLogged();
		onClose();
	}

	function handleAddNew() {
		onClose();
		router.push(tab === "recipes" ? "/nutrition/CreateRecipe" : "/nutrition/CreateFood");
	}

	const styles = useMemo(() => makeStyles(theme, insets.bottom), [theme, insets.bottom]);

	function renderBody() {
		if (tab === "foods") {
			if (foodsLoading && foodResults.length === 0) return <Loading color={theme.primary} />;
			if (foodResults.length === 0) {
				return <Empty icon="search" text={needle ? "No foods match that search." : "Search the food database to log a food."} styles={styles} />;
			}
			return foodResults.map((food) => (
				<FoodCard key={food.id} food={food} displayLogButton mealType={mealType} loggedAt={selectedDate} onLogged={handleLogged} />
			));
		}

		if (tab === "recipes") {
			if (recipesLoading && recipes.length === 0) return <Loading color={theme.primary} />;
			if (recipesError && recipes.length === 0) return <Problem text="Couldn't load your recipes." onRetry={refetchRecipes} styles={styles} />;
			if (recipeMatches.length === 0) {
				return <Empty icon="utensils" text={needle ? "No recipes match that search." : "You haven't created any recipes yet."} styles={styles} />;
			}
			return recipeMatches.map((recipe) => (
				<RecipeLogCard
					key={recipe.id}
					recipe={recipe}
					displayLogButton
					mealType={mealType}
					loggedAt={selectedDate}
					onLogged={handleLogged}
					onNavigateAway={onClose}
				/>
			));
		}

		// recent
		if (recentLoading && recentItems.length === 0) return <Loading color={theme.primary} />;
		if (recentError && recentItems.length === 0) return <Problem text="Couldn't load recent items." onRetry={refetchRecent} styles={styles} />;
		if (recentMatches.length === 0) {
			return <Empty icon="history" text={needle ? "Nothing recent matches that search." : "Foods and recipes you log will show up here."} styles={styles} />;
		}
		return recentMatches.map((it) =>
			it.type === "food" ? (
				<FoodCard key={`f-${it.food.id}`} food={it.food} displayLogButton mealType={mealType} loggedAt={selectedDate} onLogged={handleLogged} />
			) : (
				<RecipeLogCard
					key={`r-${it.recipe.id}`}
					recipe={it.recipe}
					displayLogButton
					mealType={mealType}
					loggedAt={selectedDate}
					onLogged={handleLogged}
					onNavigateAway={onClose}
				/>
			),
		);
	}

	return (
		<Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
			<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
				<View style={styles.card}>
					<View style={styles.headerRow}>
						<Text style={styles.title}>Log {mealType}</Text>
						<TouchableOpacity onPress={onClose} hitSlop={10}>
							<FontAwesome5 name="times" size={20} color={theme.primary} />
						</TouchableOpacity>
					</View>

					<View style={styles.searchBar}>
						<FontAwesome5 name="search" size={14} color={theme.inputPlaceholder} />
						<TextInput
							style={styles.searchInput}
							placeholder={SEARCH_PLACEHOLDER[tab]}
							placeholderTextColor={theme.inputPlaceholder}
							value={query}
							onChangeText={setQuery}
						/>
					</View>

					<View style={styles.tabs}>
						<SegmentedControl options={TABS} value={tab} onChange={setTab} labels={TAB_LABELS} />
					</View>

					{tab !== "recent" && (
						<TouchableOpacity style={styles.addNewButton} onPress={handleAddNew} activeOpacity={0.7}>
							<FontAwesome5 name="plus" size={12} color={theme.primary} />
							<Text style={styles.addNewText}>{tab === "recipes" ? "Add new recipe" : "Add new food"}</Text>
						</TouchableOpacity>
					)}

					<ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.listContent}>
						{renderBody()}
					</ScrollView>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}

function Loading({ color }: { color: string }) {
	return <ActivityIndicator color={color} style={{ marginTop: 32 }} />;
}

function Empty({ icon, text, styles }: { icon: string; text: string; styles: ReturnType<typeof makeStyles> }) {
	const { theme } = useTheme();
	return (
		<View style={styles.empty}>
			<FontAwesome5 name={icon} size={24} color={theme.textMuted} />
			<Text style={styles.emptyText}>{text}</Text>
		</View>
	);
}

function Problem({ text, onRetry, styles }: { text: string; onRetry: () => void; styles: ReturnType<typeof makeStyles> }) {
	const { theme } = useTheme();
	return (
		<View style={styles.empty}>
			<FontAwesome5 name="exclamation-circle" size={24} color={theme.textMuted} />
			<Text style={styles.emptyText}>{text}</Text>
			<TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.7}>
				<Text style={styles.retryText}>Retry</Text>
			</TouchableOpacity>
		</View>
	);
}

function makeStyles(theme: Theme, bottomInset: number) {
	return StyleSheet.create({
		overlay: {
			flex: 1,
			justifyContent: "flex-end",
			backgroundColor: theme.overlay,
		},
		card: {
			backgroundColor: theme.cardBg,
			borderTopLeftRadius: 20,
			borderTopRightRadius: 20,
			padding: 20,
			paddingBottom: bottomInset + 20,
			height: "90%",
		},
		headerRow: {
			flexDirection: "row",
			justifyContent: "space-between",
			alignItems: "center",
			marginBottom: 16,
		},
		title: {
			color: theme.text,
			fontSize: 18,
			fontWeight: "700",
			textTransform: "capitalize",
		},
		searchBar: {
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
			backgroundColor: theme.inputBg,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: theme.inputBorder,
			borderRadius: 12,
			paddingHorizontal: 14,
			paddingVertical: 10,
			marginBottom: 12,
		},
		searchInput: {
			flex: 1,
			color: theme.text,
			fontSize: 15,
		},
		tabs: {
			marginBottom: 12,
		},
		addNewButton: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: 8,
			borderWidth: 1.5,
			borderStyle: "dashed",
			borderColor: theme.border,
			borderRadius: 12,
			paddingVertical: 12,
			marginBottom: 14,
		},
		addNewText: {
			color: theme.primary,
			fontSize: 13,
			fontWeight: "700",
			letterSpacing: 0.3,
		},
		listContent: {
			paddingBottom: 24,
			flexGrow: 1,
		},
		empty: {
			flex: 1,
			alignItems: "center",
			justifyContent: "center",
			paddingHorizontal: 24,
			paddingTop: 48,
			gap: 10,
		},
		emptyText: {
			color: theme.textMuted,
			fontSize: 13,
			textAlign: "center",
			lineHeight: 19,
		},
		retryButton: {
			marginTop: 6,
			borderWidth: 1.5,
			borderColor: theme.primary,
			borderRadius: 8,
			paddingVertical: 7,
			paddingHorizontal: 18,
		},
		retryText: {
			color: theme.primary,
			fontSize: 13,
			fontWeight: "700",
		},
	});
}
