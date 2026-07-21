import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useMemo, useState, useEffect } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/colors"; //for typing

import { instance } from "@/utils/AxiosInterceptorHandler";

type MealType = "breakfast" | "lunch" | "dinner" | "snacks";

//likely also pass this to my full nutrition page
interface LogFoodModalProps {
	visible: boolean;
	mealType: MealType;
	onClose: () => void; //do nothing
	onLogged: () => void; //should call to update diary entries
}

//Food types to store:
interface Macro {
	nutrient_id: number;
	name: string;
	unit: string;
	amount: number;
}

interface ServingSize {
	label: string;
	weight_g: number;
}

interface MacroPer100g {
	nutrient_id: number;
	name: string;
	unit: string;
	amount_per_100g: number;
}

interface DefaultServing {
	label: string; //like oz or serving
	weight_g: number; //amount in g
	macros: Macro[]; //macros for that amount
}

interface FoodSearchResult {
	id: string;
	name: string;
	brand?: string;
	serving_sizes: ServingSize[];
	default_serving: DefaultServing;
	nutrients_per_100g: MacroPer100g[];
}

interface FoodCardProps {
	food: FoodSearchResult;
	theme: Theme;
}

function FoodCard({ food, theme }: FoodCardProps) {
	const [expanded, setExpanded] = useState(false);

	const cals = food.default_serving.macros.find((m) => m.nutrient_id === 1008)?.amount;
	const protein = food.default_serving.macros.find((m) => m.nutrient_id === 1003)?.amount;
	const carbs = food.default_serving.macros.find((m) => m.nutrient_id === 1005)?.amount;
	const fat = food.default_serving.macros.find((m) => m.nutrient_id === 1004)?.amount;

	return (
		<TouchableOpacity onPress={() => setExpanded((prev) => !prev)}>
			<Text style={{ color: "white" }}>{food.name}</Text>
			<Text>{food.brand}</Text>

			<Text style={{ fontSize: 11, color: theme.textTertiary }}>{food.default_serving.label}</Text>
			<View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
				<View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
					{cals != null && (
						<Text style={{ fontSize: 11 }}>
							<Text style={{ fontWeight: "700", color: theme.textMuted }}>{cals}</Text>
							<Text style={{ color: theme.textMuted }}> kcal</Text>
						</Text>
					)}
					{protein != null && (
						<Text style={{ fontSize: 11 }}>
							<Text style={{ fontWeight: "700", color: "#4ADE80" }}>{protein}g</Text>
							<Text style={{ color: theme.textMuted }}> P</Text>
						</Text>
					)}
					{carbs != null && (
						<Text style={{ fontSize: 11 }}>
							<Text style={{ fontWeight: "700", color: "#38BDF8" }}>{carbs}g</Text>
							<Text style={{ color: theme.textMuted }}> C</Text>
						</Text>
					)}
					{fat != null && (
						<Text style={{ fontSize: 11 }}>
							<Text style={{ fontWeight: "700", color: "#FB923C" }}>{fat}g</Text>
							<Text style={{ color: theme.textMuted }}> F</Text>
						</Text>
					)}
				</View>
			</View>

			{expanded && <View>{}</View>}
		</TouchableOpacity>
	);
}

export default function LogFoodModal({ visible, mealType, onClose }: LogFoodModalProps) {
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

	// searchQuery is a snapshot of what the user typed 300ms ago, frozen at the
	// moment this specific request was sent. query is always the live, current
	// value of the search box.
	//
	// If they don't match by the time this request resolves, it means the user
	// changed the search since this request was sent; so we discard the result
	// instead of displaying something that no longer matches what's typed.
	//
	// This guards against slow/out-of-order responses: an older request can
	// resolve after a newer one, and without this check its stale results
	// could overwrite the newer, correct ones already on screen.
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
					height: "80%",
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
							<FontAwesome5 name="times" size={20} color={theme.textMuted} />
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

					<ScrollView>
						{searchResults?.map((food) => (
							<View key={food.id}>
								<FoodCard food={food} theme={theme} />
							</View>
						))}
					</ScrollView>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}
