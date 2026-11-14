import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useMemo, useState } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useLocalSearchParams, router } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import Screen from "@/components/Screen";

import AddIngredientModal from "@/features/nutrition/components/AddIngredientModal";
import ImportRecipeModal from "@/features/nutrition/components/ImportRecipeModal";
import RecipeFoodCard from "@/features/nutrition/components/RecipeFoodCard";
import NutritionFactsLabel from "@/features/nutrition/components/NutritionLabel";
import { ImportedIngredientsCard } from "@/features/nutrition/components/ImportedIngredientsCard";
import { ImportedStepsCard } from "@/features/nutrition/components/ImportedStepsCard";
import { useRecipeEditor } from "@/features/nutrition/hooks/useRecipeEditor";
import { useRecipeImport } from "@/features/nutrition/hooks/useRecipeImport";
import { parseIngredientLine } from "@/features/nutrition/utils/ingredientParsing";
import type { RecipeIngredient } from "@/features/nutrition/types";

const SCALE_FACTORS = [0.25, 0.5, 1, 1.5, 2, 3];

export default function CreateRecipe() {
	const { theme } = useTheme();
	const { recipe_id } = useLocalSearchParams<{ recipe_id?: string }>();

	const recipe = useRecipeEditor(recipe_id);
	const imported = useRecipeImport({ applyDetails: recipe.applyImportedDetails, addIngredients: recipe.addIngredients });

	// UI-only state: the two sheets, and what the add-ingredient sheet was opened for
	const [addModalVisible, setAddModalVisible] = useState(false);
	const [importModalVisible, setImportModalVisible] = useState(false);
	const [pendingIngredientQuery, setPendingIngredientQuery] = useState<string | undefined>(undefined);
	// The imported line `pendingIngredientQuery` was derived from, so we can drop
	// that exact row once a food is added for it.
	const [pendingImportedLine, setPendingImportedLine] = useState<string | undefined>(undefined);

	// Open the food-search sheet prefilled with an imported ingredient string.
	// Track the original line so handleAddIngredient can clear the right row.
	function matchImportedIngredient(text: string) {
		setPendingImportedLine(text);
		setPendingIngredientQuery(parseIngredientLine(text).searchText);
		setAddModalVisible(true);
	}

	function openAddIngredient() {
		setPendingIngredientQuery(undefined);
		setPendingImportedLine(undefined);
		setAddModalVisible(true);
	}

	function handleAddIngredient(ingredient: RecipeIngredient) {
		recipe.addIngredients([ingredient]);
		// If this add came from matching an imported line, clear that line.
		if (pendingImportedLine) {
			imported.dismissImportedIngredient(pendingImportedLine);
			setPendingImportedLine(undefined);
			setPendingIngredientQuery(undefined);
		}
	}

	const styles = useMemo(
		() =>
			StyleSheet.create({
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
				sectionLabel: { color: theme.textSecondary, fontSize: 14, fontWeight: "700", marginBottom: 8 },
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
				macroCardLabel: { color: theme.textMuted, fontSize: 10, fontWeight: "700", marginBottom: 6 },
				macroCardValue: { fontSize: 22, fontWeight: "800" },
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
				addComponentText: { color: theme.primary, fontSize: 13, fontWeight: "700" },
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
				scaleLabel: { color: theme.textMuted, fontSize: 11, fontWeight: "700" },
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

				importBtn: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "center",
					gap: 8,
					borderWidth: 1.5,
					borderStyle: "dashed",
					borderColor: theme.primary,
					borderRadius: 14,
					paddingVertical: 14,
					marginBottom: 20,
				},
				importBtnText: { color: theme.primary, fontSize: 13, fontWeight: "700" },
			}),
		[theme],
	);

	if (recipe.loading) {
		return (
			<Screen edges={["top", "bottom"]} style={{ alignItems: "center", justifyContent: "center" }}>
				<ActivityIndicator color={theme.primary} />
			</Screen>
		);
	}

	const { totals } = recipe;

	return (
		<Screen edges={["top", "bottom"]}>
			<View style={styles.headerRow}>
				<TouchableOpacity style={styles.iconButton} onPress={() => router.back()} hitSlop={10}>
					<FontAwesome5 name="chevron-left" size={18} color={theme.text} />
				</TouchableOpacity>
			</View>
			<ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
				<Text style={styles.sectionLabel}>Recipe name</Text>
				<TextInput
					style={styles.nameInput}
					placeholder="Enter recipe name..."
					placeholderTextColor={theme.inputPlaceholder}
					value={recipe.recipeName}
					onChangeText={recipe.setRecipeName}
				/>

				<TouchableOpacity style={styles.importBtn} onPress={() => setImportModalVisible(true)} activeOpacity={0.7}>
					<FontAwesome5 name="link" size={12} color={theme.primary} />
					<Text style={styles.importBtnText}>Import from a link</Text>
				</TouchableOpacity>

				<View style={styles.macroCards}>
					<View style={styles.macroCard}>
						<Text style={styles.macroCardLabel}>Protein</Text>
						<Text style={[styles.macroCardValue, { color: theme.macroProtein }]}>{Math.round(totals.protein)}g</Text>
					</View>
					<View style={styles.macroCard}>
						<Text style={styles.macroCardLabel}>Carbs</Text>
						<Text style={[styles.macroCardValue, { color: theme.macroCarbs }]}>{Math.round(totals.carbs)}g</Text>
					</View>
					<View style={styles.macroCard}>
						<Text style={styles.macroCardLabel}>Fat</Text>
						<Text style={[styles.macroCardValue, { color: theme.macroFat }]}>{Math.round(totals.fat)}g</Text>
					</View>
				</View>

				<View style={styles.scaleRow}>
					<Text style={styles.scaleLabel}>Scale recipe</Text>
					<View style={styles.scaleButtons}>
						{SCALE_FACTORS.map((factor) => (
							<TouchableOpacity
								key={factor}
								style={styles.scaleBtn}
								onPress={() => recipe.scaleAllIngredients(factor)}
								disabled={recipe.ingredients.length === 0}
							>
								<Text style={styles.scaleBtnText}>{factor}x</Text>
							</TouchableOpacity>
						))}
					</View>
				</View>

				{recipe.ingredients.map((ing) => (
					<RecipeFoodCard key={ing.id} mode="edit" ingredient={ing} onChange={recipe.changeIngredient} onRemove={recipe.removeIngredient} />
				))}

				{imported.importedIngredients.length > 0 && (
					<ImportedIngredientsCard
						lines={imported.importedIngredients}
						sourceUrl={imported.importSourceUrl}
						autoMatching={imported.autoMatching}
						onRetryMatch={() => imported.runAutoMatch(imported.importedIngredients)}
						onPressLine={matchImportedIngredient}
						onDismissLine={imported.dismissImportedIngredient}
					/>
				)}

				<TouchableOpacity style={styles.addComponentBtn} onPress={openAddIngredient} activeOpacity={0.7}>
					<FontAwesome5 name="plus" size={12} color={theme.primary} />
					<Text style={styles.addComponentText}>Add ingredient</Text>
				</TouchableOpacity>

				{imported.importedInstructions.length > 0 && <ImportedStepsCard steps={imported.importedInstructions} />}

				<View style={styles.servingsRow}>
					<Text style={styles.servingsLabel}>Servings this makes</Text>
					<TextInput style={styles.servingsInput} keyboardType="number-pad" value={recipe.servings} onChangeText={recipe.changeServings} />
				</View>

				<NutritionFactsLabel nutrients={totals.nutrients} totalWeightG={totals.weight} servings={parseFloat(recipe.servings) || 1} />

				<AddIngredientModal
					visible={addModalVisible}
					initialQuery={pendingIngredientQuery}
					onClose={() => {
						setAddModalVisible(false);
						setPendingIngredientQuery(undefined);
						setPendingImportedLine(undefined);
					}}
					onAdd={handleAddIngredient}
				/>

				<ImportRecipeModal visible={importModalVisible} onClose={() => setImportModalVisible(false)} onImported={imported.handleImported} />

				<TouchableOpacity
					style={[styles.saveButton, recipe.saving && { opacity: 0.6 }]}
					onPress={recipe.save}
					disabled={recipe.saving || !recipe.recipeName || recipe.ingredients.length === 0}
					activeOpacity={0.85}
				>
					{recipe.saving ? (
						<ActivityIndicator color={theme.cardBg} />
					) : (
						<Text style={styles.saveButtonText}>{recipe_id ? "Save changes" : "Save recipe"}</Text>
					)}
				</TouchableOpacity>
			</ScrollView>
		</Screen>
	);
}
