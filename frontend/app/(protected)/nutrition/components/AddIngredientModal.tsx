import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMemo, useState, useEffect } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";

import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";

import RecipeFoodCard from "./RecipeFoodCard";
import type { FoodSearchResult, RecipeIngredient } from "../../types/nutrition";

interface AddIngredientModalProps {
	visible: boolean;
	onClose: () => void;
	onAdd: (ingredient: RecipeIngredient) => void;
}

// Same search-debounce pattern as LogFoodModal
export default function AddIngredientModal({ visible, onClose, onAdd }: AddIngredientModalProps) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();

	const [query, setQuery] = useState<string>("");
	const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);

	async function searchForFoods(searchQuery: string) {
		try {
			const res = await instance.get(`/nutrition/foods?q=${encodeURIComponent(searchQuery)}`);
			if (searchQuery !== query) return;
			setSearchResults(res.data.foods ?? []);
		} catch (e) {
			log.error("Ingredient search error:", e);
		}
	}

	useEffect(() => {
		if (!query) {
			setSearchResults([]);
			return;
		}
		const timeoutId = setTimeout(() => searchForFoods(query), 300);
		return () => clearTimeout(timeoutId);
	}, [query]);

	const styles = useMemo(
		() =>
			StyleSheet.create({
				overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: theme.overlay },
				card: { backgroundColor: theme.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: insets.bottom + 20, height: "90%" },
				headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
				title: { color: theme.text, fontSize: 18, fontWeight: "700" },
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
					marginBottom: 16,
				},
				searchInput: { flex: 1, color: theme.text, fontSize: 15 },
			}),
		[theme, insets.bottom],
	);

	return (
		<Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
			<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
				<View style={styles.card}>
					<View style={styles.headerRow}>
						<Text style={styles.title}>Add Ingredient</Text>
						<TouchableOpacity onPress={onClose} hitSlop={10}>
							<FontAwesome5 name="times" size={20} color={theme.primary} />
						</TouchableOpacity>
					</View>

					<View style={styles.searchBar}>
						<FontAwesome5 name="search" size={14} color={theme.inputPlaceholder} />
						<TextInput
							style={styles.searchInput}
							placeholder="Search for food..."
							placeholderTextColor={theme.inputPlaceholder}
							value={query}
							onChangeText={setQuery}
						/>
					</View>

					<ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
						{searchResults.map((food) => (
							<RecipeFoodCard key={food.id} mode="add" food={food} onAdd={onAdd} />
						))}
					</ScrollView>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}
