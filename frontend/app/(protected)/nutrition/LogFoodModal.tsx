import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useMemo, useState, useEffect } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/colors"; //for typing

import { instance } from "@/utils/AxiosInterceptorHandler";

import FoodCard from "../components/FoodCard";
import { type FoodSearchResult } from "../types/nutrition";

type MealType = "breakfast" | "lunch" | "dinner" | "snacks";

//likely also pass this to my full nutrition page
interface LogFoodModalProps {
	visible: boolean;
	mealType: MealType;
	selectedDate: string;
	onClose: () => void; //do nothing
	onLogged: () => void; //should call to update diary entries
}

export default function LogFoodModal({ visible, mealType, selectedDate, onClose, onLogged }: LogFoodModalProps) {
	const { theme } = useTheme();

	const [query, setQuery] = useState<string>("");
	const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);

	const [loading, setLoading] = useState<Boolean>(true);

	async function searchForFoods(searchQuery: string) {
		try {
			const res = await instance.get(`/nutrition/foods?q=${encodeURIComponent(searchQuery)}`);
			if (searchQuery !== query) return;
			setSearchResults(res.data.foods ?? []);
		} catch (e) {
			console.error("Nutrition fetch error:", e);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		if (!query) {
			setSearchResults([]);
			return;
		}

		const timeoutId = setTimeout(() => {
			searchForFoods(query);
		}, 300);

		return () => clearTimeout(timeoutId);
	}, [query]);

	function handleFoodLogged() {
		//Foodcard will say some food item is logged, we will then close the modal and re-fetch entries?
		onLogged();
		onClose(); //hmm maybe don't do this.
	}

	const styles = useMemo(
		() =>
			StyleSheet.create({
				overlay: {
					flex: 1,
					justifyContent: "flex-end",
					backgroundColor: "rgba(0,0,0,0.4)",
				},
				card: {
					backgroundColor: theme.cardBg,
					borderTopLeftRadius: 20,
					borderTopRightRadius: 20,
					padding: 20,
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
				placeholder: {
					color: theme.textMuted,
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
					marginBottom: 16,
				},
				searchInput: {
					flex: 1,
					color: theme.text,
					fontSize: 15,
				},
			}),
		[theme],
	);

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
							placeholder="Search for food..."
							placeholderTextColor={theme.inputPlaceholder}
							editable={true}
							value={query}
							onChangeText={setQuery}
						/>
					</View>

					<ScrollView showsVerticalScrollIndicator={false}>
						{searchResults?.map((food) => (
							<FoodCard key={food.id} food={food} displayLogButton={true} mealType={mealType} loggedAt={selectedDate} onLogged={handleFoodLogged} />
						))}
					</ScrollView>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}
