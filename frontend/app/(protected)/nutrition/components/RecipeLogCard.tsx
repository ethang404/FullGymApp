import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { useMemo, useState } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { router } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";

import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import { toast } from "@/utils/toast";
import type { RecipeSummary } from "../../types/nutrition";

interface RecipeLogCardProps {
	recipe: RecipeSummary;
	displayLogButton: boolean;
	mealType: string;
	loggedAt?: string;
	onLogged?: () => void;
	// Called right before navigating away (so the parent can close its modal).
	onNavigateAway?: () => void;
}

// The recipe analogue of FoodCard: shows a recipe's per-serving macros and logs
// it to the diary as `quantity` servings (unit is always "serving").
export default function RecipeLogCard({ recipe, displayLogButton, mealType, loggedAt, onLogged, onNavigateAway }: RecipeLogCardProps) {
	const { theme } = useTheme();
	const [expanded, setExpanded] = useState(false);
	const [quantity, setQuantity] = useState<string>("1");
	const [logging, setLogging] = useState(false);

	const parsedQty = parseFloat(quantity) || 0;

	// Card totals scale the per-serving values by how many servings the user logs.
	const cals = Math.round(recipe.calories_per_serving * parsedQty);
	const protein = recipe.protein_per_serving * parsedQty;
	const carbs = recipe.carbs_per_serving * parsedQty;
	const fat = recipe.fat_per_serving * parsedQty;

	function stepQuantity(delta: number) {
		setQuantity(String(Math.max(0, parsedQty + delta)));
	}

	async function handleLogRecipe() {
		if (!parsedQty || logging) return;
		setLogging(true);
		try {
			await instance.post("/nutrition/diary", {
				recipe_id: recipe.id,
				meal_type: mealType,
				logged_at: loggedAt,
				quantity: parsedQty,
				unit: "serving",
			});
			onLogged?.();
		} catch (e) {
			log.error("Failed to log recipe:", e);
			toast.error("Couldn't log that recipe. Try again.");
		} finally {
			setLogging(false);
		}
	}

	function openRecipe() {
		onNavigateAway?.();
		router.push(`/nutrition/CreateRecipe?recipe_id=${recipe.id}`);
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
				servings: { color: theme.textTertiary, fontSize: 12, marginTop: 2 },
				rightCol: { flexDirection: "row", alignItems: "center", gap: 10 },
				viewButton: { flexDirection: "row", alignItems: "center", gap: 4 },
				viewLabel: { color: theme.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
				calories: { color: theme.text, fontSize: 22, fontWeight: "700", minWidth: 34, textAlign: "right" },
				infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
				macrosRow: { flexDirection: "row", gap: 14 },
				macroText: { fontSize: 13, fontWeight: "700" },
				serving: { color: theme.textMuted, fontSize: 12 },

				quantityRow: { flexDirection: "row", alignItems: "center", marginTop: 14, gap: 10 },
				quantityLabel: { flex: 1, color: theme.textMuted, fontSize: 12, fontWeight: "700" },
				stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
				quantityInput: { color: theme.text, fontSize: 20, fontWeight: "700", minWidth: 50, textAlign: "center" },
				actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 12 },
				logButton: {
					backgroundColor: theme.primary,
					borderRadius: 8,
					paddingVertical: 8,
					paddingHorizontal: 16,
					shadowColor: theme.shadowColor,
					shadowOffset: { width: 0, height: 2 },
					shadowOpacity: 0.2,
					shadowRadius: 4,
					elevation: 4,
				},
				logButtonText: { fontSize: 14, fontWeight: "600", color: theme.textInverse },
			}),
		[theme],
	);

	return (
		<TouchableOpacity activeOpacity={0.7} style={styles.card} onPress={() => setExpanded((prev) => !prev)}>
			<View style={styles.topRow}>
				<View style={styles.nameCol}>
					<Text style={styles.name} numberOfLines={1}>
						{recipe.name}
					</Text>
					<Text style={styles.servings}>
						{recipe.servings} serving{recipe.servings === 1 ? "" : "s"} in recipe
					</Text>
				</View>

				<View style={styles.rightCol}>
					<TouchableOpacity style={styles.viewButton} onPress={openRecipe} hitSlop={8}>
						<Text style={styles.viewLabel}>VIEW</Text>
						<FontAwesome5 name="chevron-right" size={8} color={theme.primary} />
					</TouchableOpacity>
					<Text style={styles.calories}>{cals}</Text>
				</View>
			</View>

			<View style={styles.infoRow}>
				<View style={styles.macrosRow}>
					<Text style={[styles.macroText, { color: theme.macroProtein }]}>P {protein.toFixed(1)}</Text>
					<Text style={[styles.macroText, { color: theme.macroCarbs }]}>C {carbs.toFixed(1)}</Text>
					<Text style={[styles.macroText, { color: theme.macroFat }]}>F {fat.toFixed(1)}</Text>
				</View>
				<Text style={styles.serving}>
					{parsedQty} serving{parsedQty === 1 ? "" : "s"}
				</Text>
			</View>

			{expanded && (
				<View>
					<View style={styles.quantityRow}>
						<Text style={styles.quantityLabel}>SERVINGS</Text>
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

					{displayLogButton && (
						<View style={styles.actionRow}>
							<TouchableOpacity style={[styles.logButton, logging && { opacity: 0.6 }]} onPress={handleLogRecipe} activeOpacity={0.85} disabled={logging}>
								<Text style={styles.logButtonText}>{logging ? "Logging…" : "Log it!"}</Text>
							</TouchableOpacity>
						</View>
					)}
				</View>
			)}
		</TouchableOpacity>
	);
}
