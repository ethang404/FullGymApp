import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useEffect, useMemo, useState } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useLocalSearchParams, router } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import AddIngredientModal from "./components/AddIngredientModal";
import RecipeFoodCard from "./components/RecipeFoodCard";
import NutritionFactsLabel from "./components/NutritionLabel";
import { calcNutrientsFromPer100g, resolveServingWeightG, NUTRIENT_NAME_TO_IDS, NUTRIENT_IDS_TO_NAMES, type RecipeIngredient } from "../types/nutrition";

export default function CreateRecipe() {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const { recipe_id } = useLocalSearchParams<{ recipe_id?: string }>();

	const [recipeName, setRecipeName] = useState("");
	const [servings, setServings] = useState("1");
	const [baseServings, setBaseServings] = useState("1");
	const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
	const [addModalVisible, setAddModalVisible] = useState(false);
	const [loading, setLoading] = useState(!!recipe_id);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!recipe_id) return;
		let cancelled = false;

		(async () => {
			try {
				const res = await instance.get(`/nutrition/recipes/${recipe_id}`);
				if (cancelled) return;

				const recipeData = res.data.recipe ?? res.data;

				setRecipeName(recipeData.name ?? "");
				setServings(String(recipeData.servings ?? 1));
				setBaseServings(String(recipeData.servings ?? 1));

				// Map ingredients from backend structure into frontend state
				const mappedIngredients: RecipeIngredient[] = (recipeData.ingredients ?? []).map((ing: any) => {
					// Resolve unit weight in grams (explicit serving row, fixed mass
					// unit, or derived volume ratio). If truly unresolvable, fall back
					// to 1 (treat quantity as literal grams) rather than silently
					// guessing 100g, and flag it so the user notices.
					const resolved = resolveServingWeightG(ing.unit, ing.serving_sizes ?? []);
					const unitWeightG = resolved ?? 1;
					if (resolved == null) {
						console.warn(`Could not resolve unit "${ing.unit}" for ingredient "${ing.food_name}" - defaulting to 1g/unit.`);
					}

					return {
						id: String(ing.ingredient_id),
						food: {
							id: ing.food_id,
							name: ing.food_name,
							nutrients_per_100g: ing.nutrients_per_100g,
							serving_sizes: ing.serving_sizes ?? [],
						},
						quantity: ing.quantity,
						baseQuantity: ing.quantity,
						serving: {
							label: ing.unit,
							weight_g: unitWeightG,
						},
					};
				});

				setIngredients(mappedIngredients);
			} catch (e) {
				console.error("Failed to load recipe:", e);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [recipe_id]);

	async function handleSave() {
		setSaving(true);
		try {
			const payload = {
				name: recipeName,
				servings: parseFloat(servings) || 1,
				ingredients: ingredients.map((ing) => ({
					food_id: ing.food.id,
					quantity: ing.quantity,
					unit: ing.serving.label,
				})),
			};
			if (recipe_id) {
				await instance.put(`/nutrition/recipes/${recipe_id}`, payload);
			} else {
				await instance.post("/nutrition/recipes", payload);
			}
		} catch (e) {
			console.error("Failed to save recipe:", e);
		} finally {
			setSaving(false);
		}
	}

	//Dynamically calculate nutrition data based on all data for a recipe
	const totals = useMemo(() => {
		let totalWeightG = 0;
		const aggregatedById: Record<number, number> = {};

		ingredients.forEach((ing) => {
			const ingWeightG = ing.quantity * ing.serving.weight_g;
			totalWeightG += ingWeightG;

			const calculated = calcNutrientsFromPer100g(ing.quantity, ing.serving.weight_g, ing.food.nutrients_per_100g);

			calculated.forEach((n) => {
				aggregatedById[n.nutrient_id] = (aggregatedById[n.nutrient_id] || 0) + n.amount;
			});
		});

		//aggregatedById is dict of each nutrientId summed together across all ingrediants

		// Map nutrient IDs to their string keys for Nutritional label(e.g. { PROTEIN: 29.2, FAT: 8.72 })
		const nutrientsByKey: Partial<Record<keyof typeof NUTRIENT_NAME_TO_IDS, number>> = {};

		//Get all key names from NUTRIENT_NAME_TO_IDS as an array, and tell TypeScript these are type nutrient names
		const nutrientKeys = Object.keys(NUTRIENT_NAME_TO_IDS) as (keyof typeof NUTRIENT_NAME_TO_IDS)[]; //array of nutrient keys

		nutrientKeys.forEach((key) => {
			//actual storage for nutrient values
			const id = NUTRIENT_NAME_TO_IDS[key];
			nutrientsByKey[key] = aggregatedById[id] ?? 0;
		});

		return {
			protein: nutrientsByKey.PROTEIN ?? 0,
			carbs: nutrientsByKey.CARBS ?? 0,
			fat: nutrientsByKey.FAT ?? 0,
			calories: nutrientsByKey.ENERGY ?? 0,
			weight: totalWeightG,
			nutrients: nutrientsByKey,
		};
	}, [ingredients]);

	//allow us to scale all ingredients with a button!
	function scaleAllIngredients(factor: number) {
		setIngredients((prev) =>
			prev.map((ing) => {
				const base = ing.baseQuantity ?? ing.quantity;
				const nextQty = base * factor;
				const nutrients = calcNutrientsFromPer100g(nextQty, ing.serving.weight_g, ing.food.nutrients_per_100g);
				return { ...ing, quantity: nextQty, ...nutrients };
			}),
		);

		//also scale serving size
		const baseServingAmount = parseFloat(baseServings) || 1;
		setServings(String(baseServingAmount * factor));
	}

	function handleAddIngredient(ingredient: RecipeIngredient) {
		setIngredients((prev) => [...prev, ingredient]);
	}

	function handleChangeIngredient(updated: RecipeIngredient) {
		setIngredients((prev) => prev.map((ing) => (ing.id === updated.id ? updated : ing)));
	}

	function handleRemoveIngredient(id: string) {
		setIngredients((prev) => prev.filter((ing) => ing.id !== id));
	}

	const styles = useMemo(
		() =>
			StyleSheet.create({
				safe: { flex: 1, backgroundColor: theme.background },
				headerRow: {
					flexDirection: "row",
					alignItems: "center",
					paddingHorizontal: 16,
					paddingTop: 14,
					paddingBottom: 6,
				},
				iconButton: {
					width: 36,
					height: 36,
					alignItems: "center",
					justifyContent: "center",
				},
				screen: { flex: 1, backgroundColor: theme.background, padding: 16 },
				sectionLabel: { color: theme.primary, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
				nameInput: {
					backgroundColor: theme.inputBg,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.inputBorder,
					borderRadius: 12,
					paddingHorizontal: 14,
					paddingVertical: 12,
					color: theme.text,
					fontSize: 15,
					marginBottom: 20,
				},
				macroCards: { flexDirection: "row", gap: 10, marginBottom: 24 },
				macroCard: {
					flex: 1,
					backgroundColor: theme.cardBg,
					borderRadius: 14,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.border,
					paddingVertical: 14,
					alignItems: "center",
				},
				macroCardLabel: { color: theme.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 6 },
				macroCardValue: { fontSize: 22, fontWeight: "800" },
				ingredientsHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
				tapToEdit: { color: theme.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
				addComponentBtn: {
					borderWidth: 1.5,
					borderStyle: "dashed",
					borderColor: theme.border,
					borderRadius: 14,
					paddingVertical: 16,
					alignItems: "center",
					justifyContent: "center",
					flexDirection: "row",
					gap: 8,
					marginBottom: 24,
				},
				addComponentText: { color: theme.primary, fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
				servingsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
				servingsLabel: { color: theme.textMuted, fontSize: 12, fontWeight: "700", flex: 1 },
				servingsInput: {
					color: theme.text,
					fontSize: 16,
					fontWeight: "700",
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.inputBorder,
					borderRadius: 8,
					paddingHorizontal: 12,
					paddingVertical: 6,
					minWidth: 60,
					textAlign: "center",
				},
				saveButton: {
					backgroundColor: theme.primary,
					borderRadius: 12,
					paddingVertical: 14,
					alignItems: "center",
					justifyContent: "center",
					marginTop: 20,
				},
				saveButtonText: { color: theme.cardBg, fontSize: 15, fontWeight: "700" },

				scaleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 1, flexWrap: "wrap", paddingBottom: 12 },
				scaleLabel: { color: theme.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
				scaleButtons: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
				scaleBtn: {
					paddingVertical: 6,
					paddingHorizontal: 12,
					borderRadius: 20,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.border,
					backgroundColor: theme.cardBg,
				},
				scaleBtnText: { fontSize: 12, fontWeight: "700", color: theme.primary },
			}),
		[theme],
	);

	if (loading) {
		return (
			<View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
				<ActivityIndicator color={theme.primary} />
			</View>
		);
	}

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<View style={styles.headerRow}>
				<TouchableOpacity style={styles.iconButton} onPress={() => router.back()} hitSlop={10}>
					<FontAwesome5 name="chevron-left" size={18} color={theme.text} />
				</TouchableOpacity>
			</View>
			<ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
				<Text style={styles.sectionLabel}>RECIPE IDENTITY</Text>
				<TextInput
					style={styles.nameInput}
					placeholder="Enter recipe name..."
					placeholderTextColor={theme.inputPlaceholder}
					value={recipeName}
					onChangeText={setRecipeName}
				/>

				<View style={styles.macroCards}>
					<View style={styles.macroCard}>
						<Text style={styles.macroCardLabel}>PROTEIN</Text>
						<Text style={[styles.macroCardValue, { color: "#4ADE80" }]}>{Math.round(totals.protein)}g</Text>
					</View>
					<View style={styles.macroCard}>
						<Text style={styles.macroCardLabel}>CARBS</Text>
						<Text style={[styles.macroCardValue, { color: "#38BDF8" }]}>{Math.round(totals.carbs)}g</Text>
					</View>
					<View style={styles.macroCard}>
						<Text style={styles.macroCardLabel}>FATS</Text>
						<Text style={[styles.macroCardValue, { color: "#FB923C" }]}>{Math.round(totals.fat)}g</Text>
					</View>
				</View>

				<View style={styles.ingredientsHeaderRow}>
					<Text style={styles.sectionLabel}>INGREDIENTS ({String(ingredients.length).padStart(2, "0")})</Text>
					<Text style={styles.tapToEdit}>TAP TO EDIT</Text>
				</View>

				<View style={styles.scaleRow}>
					<Text style={styles.scaleLabel}>SCALE RECIPE</Text>
					<View style={styles.scaleButtons}>
						{[0.25, 0.5, 1, 1.5, 2, 3].map((factor) => (
							<TouchableOpacity key={factor} style={styles.scaleBtn} onPress={() => scaleAllIngredients(factor)} disabled={ingredients.length === 0}>
								<Text style={styles.scaleBtnText}>{factor}x</Text>
							</TouchableOpacity>
						))}
					</View>
				</View>

				{ingredients.map((ing) => (
					<RecipeFoodCard key={ing.id} mode="edit" ingredient={ing} onChange={handleChangeIngredient} onRemove={handleRemoveIngredient} />
				))}

				<TouchableOpacity style={styles.addComponentBtn} onPress={() => setAddModalVisible(true)} activeOpacity={0.7}>
					<FontAwesome5 name="plus" size={12} color={theme.primary} />
					<Text style={styles.addComponentText}>ADD COMPONENT</Text>
				</TouchableOpacity>

				<View style={styles.servingsRow}>
					<Text style={styles.servingsLabel}>SERVINGS PER RECIPE</Text>
					<TextInput
						style={styles.servingsInput}
						keyboardType="number-pad"
						value={servings}
						onChangeText={(serv) => {
							setServings(serv);
							setBaseServings(serv);
						}}
					/>
				</View>

				{/* <NutritionFactsLabel
					totalCals={totals.cals}
					totalProtein={totals.protein}
					totalCarbs={totals.carbs}
					totalFat={totals.fat}
					totalWeightG={totals.weight}
					servings={parseFloat(servings) || 1}
				/> */}

				<NutritionFactsLabel nutrients={totals.nutrients} totalWeightG={totals.weight} servings={parseFloat(servings) || 1} />

				<AddIngredientModal visible={addModalVisible} onClose={() => setAddModalVisible(false)} onAdd={handleAddIngredient} />

				<TouchableOpacity
					style={[styles.saveButton, saving && { opacity: 0.6 }]}
					onPress={handleSave}
					disabled={saving || !recipeName || ingredients.length === 0}
					activeOpacity={0.85}
				>
					{saving ? <ActivityIndicator color={theme.cardBg} /> : <Text style={styles.saveButtonText}>{recipe_id ? "Save Changes" : "Save Recipe"}</Text>}
				</TouchableOpacity>
			</ScrollView>
		</SafeAreaView>
	);
}
