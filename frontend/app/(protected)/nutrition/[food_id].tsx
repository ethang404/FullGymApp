import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";

import { instance } from "@/utils/AxiosInterceptorHandler";

import { AddServingModal } from "./components/AddServingModal";
import NutritionFactsLabel from "./components/NutritionLabel";

import {
	calcMacrosFromPer100g,
	COMMON_UNITS,
	type ServingSize,
	type FoodDetail,
	NUTRIENT_NAME_TO_IDS,
	NUTRIENT_IDS_TO_NAMES,
	calcNutrientsFromPer100g,
} from "../types/nutrition";

export default function FoodDetailScreen() {
	const { theme } = useTheme();
	const { food_id, serving_label, serving_weight_g, quantity } = useLocalSearchParams<{
		food_id: string;
		serving_label?: string;
		serving_weight_g?: string;
		quantity?: string;
	}>();

	const [food, setFood] = useState<FoodDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [quantityText, setQuantityText] = useState(quantity ?? "1");

	const initialServing: ServingSize | null = serving_label && serving_weight_g ? { label: serving_label, weight_g: parseFloat(serving_weight_g) } : null;

	const [selectedServing, setSelectedServing] = useState<ServingSize | null>(initialServing);
	const [servingOptions, setServingOptions] = useState<ServingSize[]>(initialServing ? [initialServing] : []);

	const [addServingModalVisible, setAddServingModalVisible] = useState(false);
	const [isFavorited, setIsFavorited] = useState(false);

	const fetchFood = useCallback(async () => {
		try {
			setError(null);
			const res = await instance.get(`/nutrition/foods/${food_id}`);
			const fetchedFood: FoodDetail = res.data.food;
			setFood(fetchedFood);

			setServingOptions((prev) => {
				const merged = [...fetchedFood.serving_sizes];
				if (initialServing && !merged.some((s) => s.label === initialServing.label && s.weight_g === initialServing.weight_g)) {
					merged.push(initialServing);
				}
				return merged;
			});

			setSelectedServing((prev) => {
				if (prev) {
					const match = fetchedFood.serving_sizes.find((s) => s.label === prev.label);
					if (match) return match;
					return prev;
				}
				return fetchedFood.serving_sizes[0] ?? null;
			});
		} catch (e) {
			console.error("Failed to fetch food:", e);
			setError("Sorry I couldn't load this food. Pull down to try again.");
		} finally {
			setLoading(false);
		}
	}, [food_id]);

	useEffect(() => {
		fetchFood();
	}, [food_id]);

	const usedLabels = useMemo(() => new Set(servingOptions.map((s) => s.label)), [servingOptions]);
	const availableUnits = useMemo(() => COMMON_UNITS.filter((u) => !usedLabels.has(u)), [usedLabels]);

	const parsedQty = parseFloat(quantityText) || 0;

	function stepQuantity(delta: number) {
		const next = Math.max(0, Math.round((parsedQty + delta) * 10) / 10);
		setQuantityText(String(next));
	}

	function handleServingAdded(created: ServingSize) {
		setServingOptions((prev) => [...prev, created]);
		setSelectedServing(created);
		setAddServingModalVisible(false);
	}

	const calculatedNutrients = useMemo(() => {
		if (!food || !selectedServing) return [];
		return calcNutrientsFromPer100g(parsedQty, selectedServing.weight_g, food.nutrients_per_100g);
	}, [food, selectedServing, parsedQty]);

	const nutrientsMap = useMemo(() => {
		const map: Partial<Record<keyof typeof NUTRIENT_NAME_TO_IDS, number>> = {};

		calculatedNutrients.forEach((item) => {
			const nameKey = NUTRIENT_IDS_TO_NAMES[item.nutrient_id] as keyof typeof NUTRIENT_NAME_TO_IDS;
			if (nameKey) {
				map[nameKey] = item.amount;
			}
		});

		return map;
	}, [calculatedNutrients]);

	// Macro Breakdown for the top energy bar
	const { cals, protein, carbs, fat } = useMemo(() => {
		return {
			cals: nutrientsMap.ENERGY,
			protein: nutrientsMap.PROTEIN,
			carbs: nutrientsMap.CARBS,
			fat: nutrientsMap.FAT,
		};
	}, [nutrientsMap]);

	const macroKcalTotal = (protein ?? 0) * 4 + (carbs ?? 0) * 4 + (fat ?? 0) * 9 || 1;
	const totalWeightG = (selectedServing?.weight_g ?? 0) * parsedQty;

	const styles = useMemo(
		() =>
			StyleSheet.create({
				screen: { flex: 1, backgroundColor: theme.background ?? theme.cardBg },
				center: { flex: 1, alignItems: "center", justifyContent: "center" },
				errorText: { color: theme.textMuted, textAlign: "center", paddingHorizontal: 24 },
				headerRow: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					paddingHorizontal: 16,
					paddingTop: 14,
					paddingBottom: 6,
				},
				headerCenter: { flex: 1, alignItems: "center" },
				foodName: { color: theme.text, fontSize: 16, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" },
				foodMeta: { color: theme.textMuted, fontSize: 11, letterSpacing: 0.5, marginTop: 2, textTransform: "uppercase" },
				iconButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

				card: {
					backgroundColor: theme.cardBg,
					borderRadius: 16,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.border,
					padding: 16,
					marginHorizontal: 16,
				},
				energyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
				eyebrow: { color: theme.textMuted, fontSize: 10.5, fontWeight: "700", letterSpacing: 1 },
				energyValueRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 },
				energyValue: { color: theme.text, fontSize: 40, fontWeight: "800" },
				energyUnit: { color: theme.textMuted, fontSize: 14 },

				stepperRow: {
					flexDirection: "row",
					alignItems: "center",
					gap: 10,
					marginTop: 8,
					backgroundColor: theme.inputBg,
					borderRadius: 10,
					paddingHorizontal: 6,
					paddingVertical: 4,
				},
				quantityInput: { color: theme.text, fontSize: 16, fontWeight: "700", minWidth: 36, textAlign: "center" },
				macroBar: { flexDirection: "row", height: 6, borderRadius: 4, overflow: "hidden", marginTop: 16 },

				servingRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 4 },
				servingPill: {
					paddingVertical: 6,
					paddingHorizontal: 12,
					borderRadius: 20,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.border,
				},
				servingPillSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
				servingPillText: { fontSize: 12, fontWeight: "600", color: theme.text },
				servingPillTextSelected: { color: theme.cardBg },
			}),
		[theme],
	);

	if (loading) {
		return (
			<View style={[styles.screen, styles.center]}>
				<ActivityIndicator color={theme.primary} />
			</View>
		);
	}

	if (error || !food) {
		return (
			<View style={[styles.screen, styles.center]}>
				<Text style={styles.errorText}>{error ?? "This food couldn't be found."}</Text>
			</View>
		);
	}

	return (
		<SafeAreaView style={styles.screen} edges={["top"]}>
			<View style={styles.headerRow}>
				<TouchableOpacity style={styles.iconButton} onPress={() => router.back()} hitSlop={10}>
					<FontAwesome5 name="chevron-left" size={18} color={theme.text} />
				</TouchableOpacity>
				<View style={styles.headerCenter}>
					<Text style={styles.foodName} numberOfLines={1}>
						{food.name}
					</Text>
					<Text style={styles.foodMeta} numberOfLines={1}>
						{[food.brand, selectedServing ? `${selectedServing.weight_g}g per ${selectedServing.label}` : null].filter(Boolean).join(" · ")}
					</Text>
				</View>
				<TouchableOpacity style={styles.iconButton} onPress={() => setIsFavorited((v) => !v)} hitSlop={10}>
					<FontAwesome5 name="heart" size={18} color={isFavorited ? "#F87171" : theme.textMuted} solid={isFavorited} />
				</TouchableOpacity>
			</View>

			<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
				<View style={styles.card}>
					<View style={styles.energyRow}>
						<View>
							<Text style={styles.eyebrow}>TOTAL ENERGY</Text>
							<View style={styles.energyValueRow}>
								<Text style={styles.energyValue}>{cals != null ? Math.round(cals) : "—"}</Text>
								<Text style={styles.energyUnit}>kcal</Text>
							</View>
						</View>
						<View>
							<Text style={[styles.eyebrow, { textAlign: "right" }]}>QUANTITY</Text>
							<View style={styles.stepperRow}>
								<TouchableOpacity onPress={() => stepQuantity(-0.5)} hitSlop={8}>
									<FontAwesome5 name="minus-circle" size={18} color={theme.primary} />
								</TouchableOpacity>
								<TextInput style={styles.quantityInput} keyboardType="decimal-pad" value={quantityText} onChangeText={setQuantityText} />
								<TouchableOpacity onPress={() => stepQuantity(0.5)} hitSlop={8}>
									<FontAwesome5 name="plus-circle" size={18} color={theme.primary} />
								</TouchableOpacity>
							</View>
						</View>
					</View>

					<View style={styles.macroBar}>
						<View style={{ width: `${((protein ?? 0) * 4 * 100) / macroKcalTotal}%`, backgroundColor: "#4ADE80" }} />
						<View style={{ width: `${((carbs ?? 0) * 4 * 100) / macroKcalTotal}%`, backgroundColor: "#38BDF8" }} />
						<View style={{ width: `${((fat ?? 0) * 9 * 100) / macroKcalTotal}%`, backgroundColor: "#FB923C" }} />
					</View>
				</View>

				<View style={[styles.card, { marginTop: 12 }]}>
					<Text style={{ color: theme.text, fontSize: 15, fontWeight: "700" }}>Serving size</Text>
					<View style={styles.servingRow}>
						{servingOptions.map((opt) => {
							const isSelected = opt.label === selectedServing?.label && opt.weight_g === selectedServing?.weight_g;
							return (
								<TouchableOpacity
									key={opt.label}
									style={[styles.servingPill, isSelected && styles.servingPillSelected]}
									onPress={() => setSelectedServing(opt)}
								>
									<Text style={[styles.servingPillText, isSelected && styles.servingPillTextSelected]}>
										{opt.label} ({opt.weight_g}g)
									</Text>
								</TouchableOpacity>
							);
						})}
						<TouchableOpacity style={styles.servingPill} onPress={() => setAddServingModalVisible(true)}>
							<Text style={styles.servingPillText}> + </Text>
						</TouchableOpacity>
					</View>
				</View>

				<View style={{ marginHorizontal: 16 }}>
					<NutritionFactsLabel
						nutrients={nutrientsMap}
						servings={1} // Pass 1 so perServing inside the label uses exact totals from nutrientsMap instead of recipe vals
						totalWeightG={totalWeightG}
						servingUnitText={`${parsedQty} ${selectedServing?.label ?? "serving"}`}
					/>
				</View>
			</ScrollView>

			<AddServingModal
				visible={addServingModalVisible}
				foodId={food.id}
				foodName={food.name}
				availableUnits={availableUnits}
				theme={theme}
				onClose={() => setAddServingModalVisible(false)}
				onServingAdded={handleServingAdded}
			/>
		</SafeAreaView>
	);
}
