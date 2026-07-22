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

	const serving = food.default_serving.label;

	const styles = useMemo(
		() =>
			StyleSheet.create({
				card: {
					backgroundColor: theme.cardBg,
					borderRadius: 16,
					paddingVertical: 14,
					paddingHorizontal: 16,
					marginBottom: 10,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.border,
					// subtle lift so each card reads as its own surface
					shadowColor: theme.shadowColor,
					shadowOffset: { width: 0, height: 2 },
					shadowOpacity: 0.15,
					shadowRadius: 6,
					elevation: 2,
				},
				topRow: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
				},
				nameCol: {
					flex: 1,
					paddingRight: 10,
				},
				name: {
					color: theme.text,
					fontSize: 15,
					fontWeight: "700",
				},
				brand: {
					color: theme.textTertiary,
					fontSize: 12,
					marginTop: 2,
				},
				rightCol: {
					flexDirection: "row",
					alignItems: "center",
					gap: 10,
				},
				nutritionButton: {
					flexDirection: "row",
					alignItems: "center",
					gap: 4,
				},
				nutritionLabel: {
					color: theme.textMuted,
					fontSize: 10,
					fontWeight: "700",
					letterSpacing: 0.5,
				},
				calories: {
					color: theme.text,
					fontSize: 22,
					fontWeight: "700",
					minWidth: 34,
					textAlign: "right",
				},
				infoRow: {
					flexDirection: "row",
					justifyContent: "space-between"
				},
				macrosRow: {
					flexDirection: "row",
					gap: 14,
					marginTop: 10,
				},
				macroText: {
					fontSize: 13,
				},
				macroLabel: {
					color: theme.textMuted,
				},
				serving: {
					color: theme.textMuted,
					fontSize: 12,
					marginTop: 10,
				},
			}),
		[theme],
	);

	return (
		<TouchableOpacity activeOpacity={0.7} style={styles.card} onPress={() => setExpanded((prev) => !prev)}>
			<View style={styles.topRow}>
				<View style={styles.nameCol}>
					<Text style={styles.name} numberOfLines={1}>
						{food.name}
					</Text>
					{food.brand && (
						<Text style={styles.brand} numberOfLines={1}>
							{food.brand}
						</Text>
					)}
				</View>

				<View style={styles.rightCol}>
					<View style={styles.nutritionButton}>
						<Text style={styles.nutritionLabel}>NUTRITION</Text>
						<FontAwesome5 name="chevron-right" size={8} color={theme.primary} />
					</View>
					{cals != null && <Text style={styles.calories}>{cals}</Text>}
				</View>
			</View>

			<View style={styles.infoRow}>
			<View style={styles.macrosRow}>
				{protein != null && (
					<Text style={styles.macroText}>
						<Text style={{ fontWeight: "700", color: "#4ADE80" }}>P {protein}</Text>
					</Text>
				)}
				{carbs != null && (
					<Text style={styles.macroText}>
						<Text style={{ fontWeight: "700", color: "#38BDF8" }}>C {carbs}</Text>
					</Text>
				)}
				{fat != null && (
					<Text style={styles.macroText}>
						<Text style={{ fontWeight: "700", color: "#FB923C" }}>F {fat}</Text>
					</Text>
				)}
			</View>
			<Text style={styles.serving}>{serving}</Text>
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
							<FoodCard key={food.id} food={food} theme={theme} />
						))}
					</ScrollView>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}