import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useEffect, useMemo, useState } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useLocalSearchParams, router } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import { toast } from "@/utils/toast";
import { useProfile } from "@/utils/ProfileProvider";
import Screen from "@/components/Screen";
import Pills from "@/components/Pills";

import AddIngredientModal from "./components/AddIngredientModal";
import ImportRecipeModal from "./components/ImportRecipeModal";
import RecipeFoodCard from "./components/RecipeFoodCard";
import NutritionFactsLabel from "./components/NutritionLabel";
import { getFullFood, searchFoods } from "./hooks/useFoodSearch";
import {
	calcNutrientsFromPer100g,
	calcMacrosFromPer100g,
	resolveServingWeightG,
	parseIngredientLine,
	isLikelyIngredientMatch,
	NUTRIENT_NAME_TO_IDS,
	NUTRIENT_IDS_TO_NAMES,
	type RecipeIngredient,
	type ImportedRecipe,
	type ParsedIngredientLine,
	type FoodSearchResult,
	type ServingSize,
} from "../types/nutrition";
import { CONTENT_VISIBILITIES, CONTENT_VISIBILITY_LABELS, type ContentVisibility } from "../types/visibility";

// "https://www.hungryhobby.net/x/" -> "HUNGRYHOBBY.NET" (RN's URL is spotty, so parse by hand)
function hostLabel(url: string | null): string {
	if (!url) return "LINK";
	const m = url.match(/^https?:\/\/([^/]+)/i);
	return m ? m[1].replace(/^www\./, "").toUpperCase() : "LINK";
}

export default function CreateRecipe() {
	const { theme } = useTheme();
	const { recipe_id } = useLocalSearchParams<{ recipe_id?: string }>();
	const { profile } = useProfile();

	const [recipeName, setRecipeName] = useState("");
	const [servings, setServings] = useState("1");
	const [baseServings, setBaseServings] = useState("1");
	const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
	const [addModalVisible, setAddModalVisible] = useState(false);
	const [loading, setLoading] = useState(!!recipe_id);
	const [saving, setSaving] = useState(false);
	const [ownerId, setOwnerId] = useState<number | null>(null);
	const [visibility, setVisibility] = useState<ContentVisibility>("private");

	// Only true once we've actually loaded someone else's recipe - never true while
	// creating a new one or before the fetch resolves.
	const viewOnly = !!recipe_id && ownerId != null && ownerId !== profile?.user_id;

	// Recipe imported from a URL: raw ingredient/step strings still waiting to be
	// matched to foods in our DB. Tapping one opens the search sheet prefilled.
	const [importModalVisible, setImportModalVisible] = useState(false);
	const [importedIngredients, setImportedIngredients] = useState<string[]>([]);
	const [importedInstructions, setImportedInstructions] = useState<string[]>([]);
	const [importSourceUrl, setImportSourceUrl] = useState<string | null>(null);
	const [pendingIngredientQuery, setPendingIngredientQuery] = useState<string | undefined>(undefined);
	// The imported line `pendingIngredientQuery` was derived from, so we can drop
	// that exact row once a food is added for it.
	const [pendingImportedLine, setPendingImportedLine] = useState<string | undefined>(undefined);
	const [autoMatching, setAutoMatching] = useState(false);

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
				setOwnerId(recipeData.user_id ?? null);
				setVisibility((recipeData.visibility as ContentVisibility) ?? "private");

				// Map ingredients from backend structure into frontend state
				const mappedIngredients: RecipeIngredient[] = (recipeData.ingredients ?? []).map((ing: any) => {
					// Resolve unit weight in grams (explicit serving row, fixed mass
					// unit, or derived volume ratio). If truly unresolvable, fall back
					// to 1 (treat quantity as literal grams) rather than silently
					// guessing 100g, and flag it so the user notices.
					const resolved = resolveServingWeightG(ing.unit, ing.serving_sizes ?? []);
					const unitWeightG = resolved ?? 1;
					if (resolved == null) {
						log.warn(`Could not resolve unit "${ing.unit}" for ingredient "${ing.food_name}" - defaulting to 1g/unit.`);
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
				log.error("Failed to load recipe:", e);
				if (!cancelled) toast.error("Couldn't load this recipe.");
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
				visibility,
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
			toast.success(recipe_id ? "Recipe updated." : "Recipe saved.");
		} catch (e) {
			log.error("Failed to save recipe:", e);
			toast.error("Couldn't save the recipe. Try again.");
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

	function handleImported(imported: ImportedRecipe) {
		if (imported.name) setRecipeName(imported.name);
		if (imported.servings && imported.servings > 0) {
			setServings(String(imported.servings));
			setBaseServings(String(imported.servings));
		}
		const lines = imported.ingredients ?? [];
		setImportedIngredients(lines);
		setImportedInstructions(imported.instructions ?? []);
		setImportSourceUrl(imported.source_url ?? null);

		toast.success(lines.length ? `Imported ${lines.length} ingredient${lines.length === 1 ? "" : "s"} — matching against your food list…` : "Recipe imported.");

		// Best-effort: try to resolve each line to a food automatically. Whatever
		// doesn't confidently match stays in the review list for manual search.
		void runAutoMatch(lines);
	}

	// Turn one imported ingredient line into a food-search hit, iff we're
	// confident enough to add it without the user looking at it first.
	// Returns null (never throws) so Promise.allSettled in runAutoMatch treats
	// "no match" and "search failed" the same way.
	async function autoMatchIngredient(line: string): Promise<RecipeIngredient | null> {
		const parsed = parseIngredientLine(line);
		if (!parsed.searchText) return null;

		let results: FoodSearchResult[];
		try {
			results = await searchFoods(parsed.searchText);
		} catch (e) {
			log.error(`Auto-match search failed for "${line}":`, e);
			return null;
		}
		if (results.length === 0) return null;

		const top = results[0];
		if (!isLikelyIngredientMatch(parsed.searchText, top.name)) return null;

		try {
			return await buildIngredientFromMatch(parsed, top);
		} catch (e) {
			log.error(`Auto-match failed to build ingredient for "${line}":`, e);
			return null;
		}
	}

	// quantity/unit from the recipe text if we can resolve it against this
	// food's servings, otherwise the food's own default serving (still added -
	// it's an editable RecipeFoodCard, so a wrong guess is a one-tap fix).
	async function buildIngredientFromMatch(parsed: ParsedIngredientLine, food: FoodSearchResult): Promise<RecipeIngredient> {
		let quantity = parsed.quantity ?? 1;
		let serving: ServingSize;

		const weightG = parsed.unit ? resolveServingWeightG(parsed.unit, food.serving_sizes) : null;
		if (weightG != null) {
			serving = { label: parsed.unit as string, weight_g: weightG };
		} else {
			quantity = food.default_serving.default_quantity ?? quantity;
			serving = { label: food.default_serving.label, weight_g: food.default_serving.weight_g };
		}

		// Search results only carry the 4 macro nutrients - fetch the full food
		// for accurate label math (same reason RecipeFoodCard does this on add).
		const fullFood = await getFullFood(food.id);
		const macros = calcMacrosFromPer100g(quantity, serving.weight_g, fullFood.nutrients_per_100g);

		return {
			id: `${food.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, //need temporary unique id for display
			food: fullFood,
			quantity,
			baseQuantity: quantity,
			serving,
			cals: macros.cals ?? 0,
			protein: macros.protein ?? 0,
			carbs: macros.carbs ?? 0,
			fat: macros.fat ?? 0,
		};
	}

	// Runs the auto-matcher over `lines` in parallel and merges whatever hits
	// straight into the recipe's ingredient list. Uses functional state updates
	// throughout so a manual match/dismiss the user makes while this is in
	// flight isn't clobbered when it resolves.
	async function runAutoMatch(IngredientLines: string[]) {
		if (IngredientLines.length === 0) return;
		setAutoMatching(true);

		const settled = await Promise.allSettled(IngredientLines.map((line) => autoMatchIngredient(line)));

		const createdIngredients: RecipeIngredient[] = [];
		const matchedLines = new Set<string>();
		settled.forEach((result, i) => {
			if (result.status === "fulfilled" && result.value) {
				createdIngredients.push(result.value);
				matchedLines.add(IngredientLines[i]);
			}
		});

		if (createdIngredients.length > 0) {
			setIngredients((prev) => [...prev, ...createdIngredients]);
			setImportedIngredients((prev) => prev.filter((line) => !matchedLines.has(line))); //keep only lines not found/matched
		}

		setAutoMatching(false);
		toast[createdIngredients.length ? "success" : "error"](
			createdIngredients.length
				? `Auto-matched ${createdIngredients.length}/${IngredientLines.length} ingredient${IngredientLines.length === 1 ? "" : "s"}. Review the rest below.`
				: "Couldn't auto-match any ingredients — tap one below to search manually.",
		);
	}

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

	function dismissImportedIngredient(text: string) {
		setImportedIngredients((prev) => prev.filter((t) => t !== text));
	}

	function handleAddIngredient(ingredient: RecipeIngredient) {
		setIngredients((prev) => [...prev, ingredient]);
		// If this add came from matching an imported line, clear that line.
		if (pendingImportedLine) {
			dismissImportedIngredient(pendingImportedLine);
			setPendingImportedLine(undefined);
			setPendingIngredientQuery(undefined);
		}
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
				viewOnlyBanner: {
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
					backgroundColor: theme.cardBgAlt,
					borderRadius: 10,
					paddingVertical: 10,
					paddingHorizontal: 14,
					marginBottom: 16,
				},
				viewOnlyBannerText: { color: theme.textMuted, fontSize: 12, fontWeight: "600" },
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
				importBtnText: { color: theme.primary, fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },

				importedCard: {
					backgroundColor: theme.cardBg,
					borderRadius: 14,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.border,
					padding: 14,
					marginBottom: 20,
				},
				importedHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 4 },
				importedHint: { flex: 1, color: theme.textMuted, fontSize: 11, lineHeight: 15 },
				retryMatchBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 2 },
				retryMatchText: { color: theme.primary, fontSize: 11, fontWeight: "700" },
				importedRow: {
					flexDirection: "row",
					alignItems: "center",
					gap: 10,
					paddingVertical: 10,
					borderTopWidth: StyleSheet.hairlineWidth,
					borderTopColor: theme.border,
				},
				importedText: { flex: 1, color: theme.text, fontSize: 18 },
				importedInstruction: { color: theme.textMuted, fontSize: 12, lineHeight: 17, marginTop: 6 },
			}),
		[theme],
	);

	if (loading) {
		return (
			<Screen edges={["top", "bottom"]} style={{ alignItems: "center", justifyContent: "center" }}>
				<ActivityIndicator color={theme.primary} />
			</Screen>
		);
	}

	return (
		<Screen edges={["top", "bottom"]}>
			<View style={styles.headerRow}>
				<TouchableOpacity style={styles.iconButton} onPress={() => router.back()} hitSlop={10}>
					<FontAwesome5 name="chevron-left" size={18} color={theme.text} />
				</TouchableOpacity>
			</View>
			<ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
				{viewOnly && (
					<View style={styles.viewOnlyBanner}>
						<FontAwesome5 name="eye" size={11} color={theme.textMuted} />
						<Text style={styles.viewOnlyBannerText}>Viewing a shared recipe — read only</Text>
					</View>
				)}

				<Text style={styles.sectionLabel}>RECIPE IDENTITY</Text>
				<TextInput
					style={[styles.nameInput, viewOnly && { color: theme.textMuted }]}
					placeholder="Enter recipe name..."
					placeholderTextColor={theme.inputPlaceholder}
					value={recipeName}
					onChangeText={setRecipeName}
					editable={!viewOnly}
				/>

				{!viewOnly && (
					<>
						<Text style={styles.sectionLabel}>VISIBILITY</Text>
						<Pills options={CONTENT_VISIBILITIES} value={visibility} onSelect={setVisibility} labels={CONTENT_VISIBILITY_LABELS} />

						<TouchableOpacity style={styles.importBtn} onPress={() => setImportModalVisible(true)} activeOpacity={0.7}>
							<FontAwesome5 name="link" size={12} color={theme.primary} />
							<Text style={styles.importBtnText}>IMPORT FROM A LINK</Text>
						</TouchableOpacity>
					</>
				)}

				<View style={styles.macroCards}>
					<View style={styles.macroCard}>
						<Text style={styles.macroCardLabel}>PROTEIN</Text>
						<Text style={[styles.macroCardValue, { color: theme.macroProtein }]}>{Math.round(totals.protein)}g</Text>
					</View>
					<View style={styles.macroCard}>
						<Text style={styles.macroCardLabel}>CARBS</Text>
						<Text style={[styles.macroCardValue, { color: theme.macroCarbs }]}>{Math.round(totals.carbs)}g</Text>
					</View>
					<View style={styles.macroCard}>
						<Text style={styles.macroCardLabel}>FATS</Text>
						<Text style={[styles.macroCardValue, { color: theme.macroFat }]}>{Math.round(totals.fat)}g</Text>
					</View>
				</View>

				{!viewOnly && (
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
				)}

				{ingredients.map((ing) => (
					<RecipeFoodCard key={ing.id} mode="edit" ingredient={ing} onChange={handleChangeIngredient} onRemove={handleRemoveIngredient} readOnly={viewOnly} />
				))}

				{!viewOnly && importedIngredients.length > 0 && (
					<View style={styles.importedCard}>
						<View style={styles.importedHeaderRow}>
							<Text style={styles.importedHint}>
								FROM {hostLabel(importSourceUrl)} · {autoMatching ? "auto-matching…" : "tap an item to find and add the matching food, or dismiss it with ✕."}
							</Text>
							{!autoMatching && (
								<TouchableOpacity style={styles.retryMatchBtn} onPress={() => runAutoMatch(importedIngredients)}>
									<FontAwesome5 name="magic" size={10} color={theme.primary} />
									<Text style={styles.retryMatchText}>MATCH</Text>
								</TouchableOpacity>
							)}
							{autoMatching && <ActivityIndicator size="small" color={theme.primary} />}
						</View>
						{importedIngredients.map((text, i) => (
							<View key={`${text}-${i}`} style={styles.importedRow}>
								<FontAwesome5 name="search" size={20} color={theme.primary} />
								<Text style={styles.importedText} onPress={() => matchImportedIngredient(text)}>
									{text}
								</Text>
								<TouchableOpacity onPress={() => dismissImportedIngredient(text)} hitSlop={10}>
									<FontAwesome5 name="times" size={20} color={theme.textMuted} />
								</TouchableOpacity>
							</View>
						))}
					</View>
				)}

				{!viewOnly && (
					<TouchableOpacity style={styles.addComponentBtn} onPress={openAddIngredient} activeOpacity={0.7}>
						<FontAwesome5 name="plus" size={12} color={theme.primary} />
						<Text style={styles.addComponentText}>ADD COMPONENT</Text>
					</TouchableOpacity>
				)}

				{importedInstructions.length > 0 && (
					<View style={styles.importedCard}>
						<Text style={styles.sectionLabel}>IMPORTED STEPS ({String(importedInstructions.length).padStart(2, "0")})</Text>
						{importedInstructions.map((step, i) => (
							<Text key={i} style={styles.importedInstruction}>
								{i + 1}. {step}
							</Text>
						))}
					</View>
				)}

				<View style={styles.servingsRow}>
					<Text style={styles.servingsLabel}>SERVINGS PER RECIPE</Text>
					<TextInput
						style={[styles.servingsInput, viewOnly && { color: theme.textMuted }]}
						keyboardType="number-pad"
						value={servings}
						onChangeText={(serv) => {
							setServings(serv);
							setBaseServings(serv);
						}}
						editable={!viewOnly}
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

				<ImportRecipeModal visible={importModalVisible} onClose={() => setImportModalVisible(false)} onImported={handleImported} />

				{!viewOnly && (
					<TouchableOpacity
						style={[styles.saveButton, saving && { opacity: 0.6 }]}
						onPress={handleSave}
						disabled={saving || !recipeName || ingredients.length === 0}
						activeOpacity={0.85}
					>
						{saving ? <ActivityIndicator color={theme.cardBg} /> : <Text style={styles.saveButtonText}>{recipe_id ? "Save Changes" : "Save Recipe"}</Text>}
					</TouchableOpacity>
				)}
			</ScrollView>
		</Screen>
	);
}
