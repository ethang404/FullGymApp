import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useMemo, useState } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";

import { COMMON_UNITS, calcMacrosFromPer100g, type ServingSize, type FoodSearchResult } from "../../types/nutrition";
import { AddServingModal } from "./AddServingModal";
import type { RecipeIngredient } from "../../types/nutrition";

//This component will give us 2 options, used in creating a new recipe
//we either add a new ingrediant and pass data to main component
//Or we can edit/remove an existing ingrediant by tapping on itself or the "x"

type RecipeFoodCardProps =
	| {
			mode: "add";
			food: FoodSearchResult;
			onAdd: (ingredient: RecipeIngredient) => void;
			ingredient?: undefined;
			onChange?: undefined;
			onRemove?: undefined;
	  }
	| {
			mode: "edit";
			ingredient: RecipeIngredient;
			onChange: (updated: RecipeIngredient) => void;
			onRemove: (id: string) => void;
			food?: undefined;
			onAdd?: undefined;
	  };

export default function RecipeFoodCard(props: RecipeFoodCardProps) {
	const { theme } = useTheme();
	const food = props.mode === "add" ? props.food : props.ingredient.food;

	const [expanded, setExpanded] = useState(false);
	const [quantity, setQuantity] = useState<string>(props.mode === "edit" ? String(props.ingredient.quantity) : "1");

	const [selectedServing, setSelectedServing] = useState<ServingSize>(
		props.mode === "edit" ? props.ingredient.serving : { label: food.default_serving.label, weight_g: food.default_serving.weight_g },
	);

	const [addServingModalVisible, setAddServingModalVisible] = useState(false);

	/* const [servingOptions, setServingOptions] = useState<ServingSize[]>(() => {
		const hasGrams = food.serving_sizes.some((s) => s.label === "g");
		return hasGrams ? food.serving_sizes : [{ label: "g", weight_g: 1 }, ...food.serving_sizes];
	}); */

	const [servingOptions, setServingOptions] = useState<ServingSize[]>(food.serving_sizes);

	const usedLabels = useMemo(() => new Set(servingOptions.map((s) => s.label)), [servingOptions]);
	const availableUnits = useMemo(() => COMMON_UNITS.filter((u) => !usedLabels.has(u)), [usedLabels]);

	const parsedQty = parseFloat(quantity) || 0;

	const { cals, protein, carbs, fat } = useMemo(
		() => calcMacrosFromPer100g(parsedQty, selectedServing.weight_g, food.nutrients_per_100g),
		[parsedQty, selectedServing, food.nutrients_per_100g],
	);

	const [isAdding, setIsAdding] = useState(false);

	//This endpoint is specifically for getting full food nutritional data so we can calculate the correct values for FDA
	//(on add)
	//This might be overkill for a recipe? But maybe it's worth the cost and easy to expand later
	async function getFullFood(foodId: number) {
		const res = await instance.get(`/nutrition/foods/${foodId}`);
		return res.data.food ?? res.data;
	}

	function handleServingAdded(created: ServingSize) {
		setServingOptions((prev) => [...prev, created]);
		setSelectedServing(created);
		setAddServingModalVisible(false);
		if (props.mode === "edit") commitChange(parsedQty, created);
	}

	function commitChange(nextQty: number, nextServing: ServingSize) {
		if (props.mode !== "edit") return;
		const macros = calcMacrosFromPer100g(nextQty, nextServing.weight_g, food.nutrients_per_100g);
		props.onChange({ ...props.ingredient, quantity: nextQty, serving: nextServing, ...macros });
	}

	function stepQuantity(delta: number) {
		const next = Math.max(0, parsedQty + delta);
		setQuantity(String(next));
		if (props.mode === "edit") commitChange(next, selectedServing);
	}

	function selectServing(opt: ServingSize) {
		setSelectedServing(opt);
		if (props.mode === "edit") commitChange(parsedQty, opt);
	}

	async function handleAdd() {
		if (props.mode !== "add" || !parsedQty || isAdding) return;

		setIsAdding(true);
		try {
			const fullFood = await getFullFood(food.id);
			props.onAdd({
				id: `${food.id}-${Date.now()}`, //do something like this to handle same food twice in a recipe
				food: fullFood,
				quantity: parsedQty,
				serving: selectedServing,
				cals: cals ?? 0,
				protein: protein ?? 0,
				carbs: carbs ?? 0,
				fat: fat ?? 0,
			});

			setQuantity("1");
			setExpanded(false);
		} catch (e) {
			console.error("Failed to fetch full food data:", e);
		} finally {
			setIsAdding(false);
		}
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
				},
				topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
				nameCol: { flex: 1, paddingRight: 10 },
				name: { color: theme.text, fontSize: 15, fontWeight: "700" },
				nameEdit: { textTransform: "uppercase", fontSize: 14 },
				brand: { color: theme.textTertiary, fontSize: 12, marginTop: 2 },
				removeBtn: { padding: 2 },
				calories: { color: theme.text, fontSize: 22, fontWeight: "700", minWidth: 34, textAlign: "right" },
				metaText: { color: theme.textMuted, fontSize: 12, marginTop: 4 },
				infoRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
				macrosRow: { flexDirection: "row", gap: 14, marginTop: 8 },
				macroText: { fontSize: 13, fontWeight: "700" },
				macroChip: { flexDirection: "row", alignItems: "center", gap: 4 },
				macroDot: { width: 6, height: 6, borderRadius: 3 },
				macroChipText: { fontSize: 12, fontWeight: "600", color: theme.textMuted },
				serving: { color: theme.textMuted, fontSize: 12 },
				quantityRow: { flexDirection: "row", alignItems: "center", marginTop: 14, gap: 10 },
				quantityLabel: { flex: 1, color: theme.textMuted, fontSize: 12, fontWeight: "700" },
				stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
				quantityInput: { color: theme.text, fontSize: 20, fontWeight: "700", minWidth: 50, textAlign: "center" },
				servingRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
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
				addButton: { backgroundColor: theme.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, marginLeft: 8 },
				addButtonText: { fontSize: 14, fontWeight: "600", color: theme.text },
			}),
		[theme],
	);

	const isEdit = props.mode === "edit";

	return (
		<>
			<TouchableOpacity activeOpacity={0.7} style={styles.card} onPress={() => setExpanded((prev) => !prev)}>
				<View style={styles.topRow}>
					<View style={styles.nameCol}>
						<Text style={[styles.name, isEdit && styles.nameEdit]} numberOfLines={1}>
							{food.name}
						</Text>
						{!isEdit && food.brand && (
							<Text style={styles.brand} numberOfLines={1}>
								{food.brand}
							</Text>
						)}
					</View>

					{isEdit ? (
						<TouchableOpacity style={styles.removeBtn} onPress={() => props.onRemove(props.ingredient.id)} hitSlop={10}>
							<FontAwesome5 name="times" size={14} color={theme.textMuted} />
						</TouchableOpacity>
					) : (
						cals != null && <Text style={styles.calories}>{Math.round(cals)}</Text>
					)}
				</View>

				{isEdit ? (
					<>
						<Text style={styles.metaText}>
							{Math.round(selectedServing.weight_g * parsedQty)}g{food.brand ? ` — ${food.brand}` : ""}
						</Text>
						<View style={styles.macrosRow}>
							<View style={styles.macroChip}>
								<View style={[styles.macroDot, { backgroundColor: "#4ADE80" }]} />
								<Text style={styles.macroChipText}>{(protein ?? 0).toFixed(0)}g P</Text>
							</View>
							<View style={styles.macroChip}>
								<View style={[styles.macroDot, { backgroundColor: "#38BDF8" }]} />
								<Text style={styles.macroChipText}>{(carbs ?? 0).toFixed(0)}g C</Text>
							</View>
							<View style={styles.macroChip}>
								<View style={[styles.macroDot, { backgroundColor: "#FB923C" }]} />
								<Text style={styles.macroChipText}>{(fat ?? 0).toFixed(0)}g F</Text>
							</View>
						</View>
					</>
				) : (
					<View style={styles.infoRow}>
						<View style={styles.macrosRow}>
							{protein != null && <Text style={[styles.macroText, { color: "#4ADE80" }]}>P {protein.toFixed(1)}</Text>}
							{carbs != null && <Text style={[styles.macroText, { color: "#38BDF8" }]}>C {carbs.toFixed(1)}</Text>}
							{fat != null && <Text style={[styles.macroText, { color: "#FB923C" }]}>F {fat.toFixed(1)}</Text>}
						</View>
						<Text style={styles.serving}>
							{selectedServing.label} ({selectedServing.weight_g}g)
						</Text>
					</View>
				)}

				{expanded && (
					<View>
						<View style={styles.quantityRow}>
							<Text style={styles.quantityLabel}>QUANTITY</Text>
							<View style={styles.stepperRow}>
								<TouchableOpacity onPress={() => stepQuantity(-1)} hitSlop={10}>
									<FontAwesome5 name="minus-circle" size={20} color={theme.primary} />
								</TouchableOpacity>
								<TextInput
									style={styles.quantityInput}
									keyboardType="decimal-pad"
									onChangeText={setQuantity}
									value={quantity}
									placeholder="1"
									onEndEditing={() => isEdit && commitChange(parseFloat(quantity) || 0, selectedServing)}
								/>
								<TouchableOpacity onPress={() => stepQuantity(1)} hitSlop={10}>
									<FontAwesome5 name="plus-circle" size={20} color={theme.primary} />
								</TouchableOpacity>
							</View>
						</View>

						<View style={styles.servingRow}>
							{servingOptions.map((opt) => {
								const isSelected = opt.label === selectedServing.label && opt.weight_g === selectedServing.weight_g;
								return (
									<TouchableOpacity key={opt.label} style={[styles.servingPill, isSelected && styles.servingPillSelected]} onPress={() => selectServing(opt)}>
										<Text style={[styles.servingPillText, isSelected && styles.servingPillTextSelected]}>{opt.label}</Text>
									</TouchableOpacity>
								);
							})}

							<TouchableOpacity key="AddMoreServing" style={styles.servingPill} onPress={() => setAddServingModalVisible(true)}>
								<Text style={styles.servingPillText}> + </Text>
							</TouchableOpacity>

							{!isEdit && (
								<TouchableOpacity
									key="AddIngredient"
									style={[styles.addButton, isAdding && { opacity: 0.6 }]}
									onPress={handleAdd}
									activeOpacity={0.85}
									disabled={isAdding}
								>
									{isAdding ? <ActivityIndicator size="small" color={theme.text} /> : <Text style={styles.addButtonText}>Add</Text>}
								</TouchableOpacity>
							)}
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
