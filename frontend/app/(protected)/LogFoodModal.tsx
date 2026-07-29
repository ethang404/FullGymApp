import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useMemo, useState, useEffect } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/colors"; //for typing

import { instance } from "@/utils/AxiosInterceptorHandler";

import { router } from "expo-router";

import { COMMON_UNITS } from "./types/nutrition";
import { AddServingModal } from "./components/AddServingModal";
import { calcMacrosFromPer100g, type ServingSize, type FoodSearchResult } from "./types/nutrition";

type MealType = "breakfast" | "lunch" | "dinner" | "snacks";

//likely also pass this to my full nutrition page
interface LogFoodModalProps {
	visible: boolean;
	mealType: MealType;
	onClose: () => void; //do nothing
	onLogged: () => void; //should call to update diary entries
}

interface FoodCardProps {
	food: FoodSearchResult;
	theme: Theme;
	onClose: () => void;
}

function FoodCard({ food, theme, onClose }: FoodCardProps) {
	const [expanded, setExpanded] = useState(false);
	const [quantity, setQuantity] = useState<string>("1");

	const [selectedServing, setSelectedServing] = useState<ServingSize>({
		label: food.default_serving.label,
		weight_g: food.default_serving.weight_g,
	});

	const [addServingModalVisible, setAddServingModalVisible] = useState(false);

	const [servingOptions, setServingOptions] = useState<ServingSize[]>(() => {
		const hasGrams = food.serving_sizes.some((s) => s.label === "g");
		return hasGrams ? food.serving_sizes : [{ label: "g", weight_g: 1 }, ...food.serving_sizes];
	});

	const usedLabels = useMemo(() => new Set(servingOptions.map((s) => s.label)), [servingOptions]);
	const availableUnits = useMemo(() => COMMON_UNITS.filter((u) => !usedLabels.has(u)), [usedLabels]);

	const parsedQty = parseFloat(quantity) || 0;

	const { cals, protein, carbs, fat } = useMemo(
		() => calcMacrosFromPer100g(parsedQty, selectedServing.weight_g, food.nutrients_per_100g),
		[parsedQty, selectedServing, food.nutrients_per_100g],
	);

	const serving = selectedServing.label;
	const serving_weight_in_grams = selectedServing.weight_g;

	function handleServingAdded(created: ServingSize) {
		setServingOptions((prev) => [...prev, created]);
		setSelectedServing(created);
		setAddServingModalVisible(false);
	}

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
					shadowColor: theme.shadowColor,
					shadowOffset: { width: 0, height: 2 },
					shadowOpacity: 0.15,
					shadowRadius: 6,
					elevation: 2,
				},
				topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
				nameCol: { flex: 1, paddingRight: 10 },
				name: { color: theme.text, fontSize: 15, fontWeight: "700" },
				brand: { color: theme.textTertiary, fontSize: 12, marginTop: 2 },
				rightCol: { flexDirection: "row", alignItems: "center", gap: 10 },
				nutritionButton: { flexDirection: "row", alignItems: "center", gap: 4 },
				nutritionLabel: { color: theme.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
				calories: { color: theme.text, fontSize: 22, fontWeight: "700", minWidth: 34, textAlign: "right" },
				infoRow: { flexDirection: "row", justifyContent: "space-between" },
				macrosRow: { flexDirection: "row", gap: 14, marginTop: 10 },
				macroText: { fontSize: 13 },
				macroLabel: { color: theme.textMuted },
				serving: { color: theme.textMuted, fontSize: 12, marginTop: 10 },

				quantityRow: { flexDirection: "row", alignItems: "center", marginTop: 14, gap: 10 },
				quantityLabel: { flex: 1, color: theme.textMuted, fontSize: 12, fontWeight: "700" },
				stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
				quantityInput: {
					color: theme.text,
					fontSize: 20,
					fontWeight: "700",
					minWidth: 50,
					textAlign: "center",
				},
				servingRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
				servingPill: {
					paddingVertical: 6,
					paddingHorizontal: 12,
					borderRadius: 20,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.border,
				},
				servingPillSelected: {
					backgroundColor: theme.primary,
					borderColor: theme.primary,
				},
				servingPillText: {
					fontSize: 12,
					fontWeight: "600",
					color: theme.text,
				},
				servingPillTextSelected: {
					color: theme.cardBg,
				},
			}),
		[theme],
	);

	function stepQuantity(delta: number) {
		const next = Math.max(0, parsedQty + delta);
		setQuantity(String(next));
	}

	return (
		<>
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
						<TouchableOpacity
							style={styles.nutritionButton}
							onPress={() => {
								onClose();
								router.push({
									pathname: "/nutrition/[food_id]",
									params: {
										food_id: food.id,
										serving_label: selectedServing.label,
										serving_weight_g: String(selectedServing.weight_g),
										quantity: quantity,
									},
								});
							}}
						>
							<Text style={styles.nutritionLabel}>NUTRITION</Text>
							<FontAwesome5 name="chevron-right" size={8} color={theme.primary} />
						</TouchableOpacity>
						{cals != null && <Text style={styles.calories}>{Math.round(cals)}</Text>}
					</View>
				</View>

				<View style={styles.infoRow}>
					<View style={styles.macrosRow}>
						{protein != null && (
							<Text style={styles.macroText}>
								<Text style={{ fontWeight: "700", color: "#4ADE80" }}>P {protein.toFixed(1)}</Text>
							</Text>
						)}
						{carbs != null && (
							<Text style={styles.macroText}>
								<Text style={{ fontWeight: "700", color: "#38BDF8" }}>C {carbs.toFixed(1)}</Text>
							</Text>
						)}
						{fat != null && (
							<Text style={styles.macroText}>
								<Text style={{ fontWeight: "700", color: "#FB923C" }}>F {fat.toFixed(1)}</Text>
							</Text>
						)}
					</View>
					<Text style={styles.serving}>
						{serving} ({serving_weight_in_grams}g)
					</Text>
				</View>

				{expanded && (
					<View>
						<View style={styles.quantityRow}>
							<Text style={styles.quantityLabel}>QUANTITY</Text>
							<View style={styles.stepperRow}>
								<TouchableOpacity onPress={() => stepQuantity(-1)} hitSlop={10}>
									<FontAwesome5 name="minus-circle" size={20} color={theme.primary} />
								</TouchableOpacity>

								<TextInput style={styles.quantityInput} keyboardType="decimal-pad" onChangeText={setQuantity} value={quantity} placeholder="1" />

								<TouchableOpacity onPress={() => stepQuantity(1)} hitSlop={10}>
									<FontAwesome5 name="plus-circle" size={20} color={theme.primary} />
								</TouchableOpacity>
							</View>
						</View>

						<View style={styles.servingRow}>
							{servingOptions.map((opt) => {
								const isSelected = opt.label === selectedServing.label && opt.weight_g === selectedServing.weight_g;
								return (
									<TouchableOpacity
										key={opt.label}
										style={[styles.servingPill, isSelected && styles.servingPillSelected]}
										onPress={() => setSelectedServing(opt)}
									>
										<Text style={[styles.servingPillText, isSelected && styles.servingPillTextSelected]}>{opt.label}</Text>
									</TouchableOpacity>
								);
							})}

							<TouchableOpacity key="AddMoreServing" style={styles.servingPill} onPress={() => setAddServingModalVisible(true)}>
								<Text style={styles.servingPillText}> + </Text>
							</TouchableOpacity>
						</View>
					</View>
				)}
			</TouchableOpacity>

			<AddServingModal
				visible={addServingModalVisible}
				foodId={food.id}
				foodName={food.name}
				availableUnits={availableUnits}
				theme={theme}
				onClose={() => setAddServingModalVisible(false)}
				onServingAdded={handleServingAdded}
			/>
		</>
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
							<FoodCard key={food.id} food={food} theme={theme} onClose={onClose} />
						))}
					</ScrollView>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}
