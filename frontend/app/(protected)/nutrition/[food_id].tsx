import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { useMemo, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import Screen from "@/components/Screen";

import { AddServingModal } from "@/features/nutrition/components/AddServingModal";
import NutritionFactsLabel from "@/features/nutrition/components/NutritionLabel";
import { ServingPicker } from "@/features/nutrition/components/ServingPicker";
import { useFoodDetail, type FoodDetailParams } from "@/features/nutrition/hooks/useFoodDetail";

export default function FoodDetailScreen() {
	const { theme } = useTheme();
	const params = useLocalSearchParams<FoodDetailParams>();
	const detail = useFoodDetail(params);

	// UI-only state
	const [addServingModalVisible, setAddServingModalVisible] = useState(false);
	const [isFavorited, setIsFavorited] = useState(false);

	// Macro Breakdown for the top energy bar
	const cals = detail.nutrientsMap.ENERGY;
	const protein = detail.nutrientsMap.PROTEIN;
	const carbs = detail.nutrientsMap.CARBS;
	const fat = detail.nutrientsMap.FAT;
	const macroKcalTotal = (protein ?? 0) * 4 + (carbs ?? 0) * 4 + (fat ?? 0) * 9 || 1;

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
				foodName: { color: theme.text, fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
				foodMeta: { color: theme.textMuted, fontSize: 11, marginTop: 2 },
				iconButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

				card: {
					backgroundColor: theme.cardBg,
					borderRadius: 16,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.border,
					padding: 16,
					marginHorizontal: 16,
				},
				cardTitle: { color: theme.text, fontSize: 15, fontWeight: "700" },
				energyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
				eyebrow: { color: theme.textMuted, fontSize: 10.5, fontWeight: "700" },
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
			}),
		[theme],
	);

	if (detail.loading) {
		return (
			<Screen edges={["top", "bottom"]} style={styles.center}>
				<ActivityIndicator color={theme.primary} />
			</Screen>
		);
	}

	if (detail.error || !detail.food) {
		return (
			<Screen edges={["top", "bottom"]} style={styles.center}>
				<Text style={styles.errorText}>{detail.error ?? "This food couldn't be found."}</Text>
			</Screen>
		);
	}

	const { food, selectedServing } = detail;

	return (
		<Screen edges={["top", "bottom"]}>
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
					<FontAwesome5 name="heart" size={18} color={isFavorited ? theme.error : theme.textMuted} solid={isFavorited} />
				</TouchableOpacity>
			</View>

			<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
				<View style={styles.card}>
					<View style={styles.energyRow}>
						<View>
							<Text style={styles.eyebrow}>Calories</Text>
							<View style={styles.energyValueRow}>
								<Text style={styles.energyValue}>{cals != null ? Math.round(cals) : "—"}</Text>
								<Text style={styles.energyUnit}>kcal</Text>
							</View>
						</View>
						<View>
							<Text style={[styles.eyebrow, { textAlign: "right" }]}>Amount</Text>
							<View style={styles.stepperRow}>
								<TouchableOpacity onPress={() => detail.stepQuantity(-0.5)} hitSlop={8}>
									<FontAwesome5 name="minus-circle" size={18} color={theme.primary} />
								</TouchableOpacity>
								<TextInput style={styles.quantityInput} keyboardType="decimal-pad" value={detail.quantityText} onChangeText={detail.setQuantityText} />
								<TouchableOpacity onPress={() => detail.stepQuantity(0.5)} hitSlop={8}>
									<FontAwesome5 name="plus-circle" size={18} color={theme.primary} />
								</TouchableOpacity>
							</View>
						</View>
					</View>

					<View style={styles.macroBar}>
						<View style={{ width: `${((protein ?? 0) * 4 * 100) / macroKcalTotal}%`, backgroundColor: theme.macroProtein }} />
						<View style={{ width: `${((carbs ?? 0) * 4 * 100) / macroKcalTotal}%`, backgroundColor: theme.macroCarbs }} />
						<View style={{ width: `${((fat ?? 0) * 9 * 100) / macroKcalTotal}%`, backgroundColor: theme.macroFat }} />
					</View>
				</View>

				<View style={[styles.card, { marginTop: 12 }]}>
					<Text style={styles.cardTitle}>Serving size</Text>
					<ServingPicker
						servings={detail.servingOptions}
						selected={selectedServing}
						onSelect={detail.selectServing}
						onAddPress={() => setAddServingModalVisible(true)}
					/>
				</View>

				<View style={{ marginHorizontal: 16 }}>
					<NutritionFactsLabel
						nutrients={detail.nutrientsMap}
						servings={1} // Pass 1 so perServing inside the label uses exact totals from nutrientsMap instead of recipe vals
						totalWeightG={detail.totalWeightG}
						servingUnitText={`${detail.parsedQty} ${selectedServing?.label ?? "serving"}`}
					/>
				</View>
			</ScrollView>

			<AddServingModal
				visible={addServingModalVisible}
				foodId={food.id}
				foodName={food.name}
				availableUnits={detail.availableUnits}
				existingServings={detail.servingOptions}
				theme={theme}
				onClose={() => setAddServingModalVisible(false)}
				onServingAdded={(created) => {
					detail.handleServingAdded(created); // data change -> hook
					setAddServingModalVisible(false); // UI change -> stays here
				}}
			/>
		</Screen>
	);
}
