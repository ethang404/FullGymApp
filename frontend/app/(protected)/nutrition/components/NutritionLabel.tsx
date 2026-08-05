import { View, Text, StyleSheet } from "react-native";
import { useMemo } from "react";
import { useTheme } from "@/theme/ThemeProvider";
import { NUTRIENT_NAME_TO_IDS } from "../../types/nutrition";

const DV = {
	fat: 78,
	saturated_fat: 20,
	cholesterol: 300,
	sodium: 2300,
	carbs: 275,
	fiber: 28,
	added_sugar: 50,
	protein: 50,
	vitamin_d: 20,
	calcium: 1300,
	iron: 18,
	potassium: 4700,
};

interface NutritionFactsLabelProps {
	nutrients: Partial<Record<keyof typeof NUTRIENT_NAME_TO_IDS, number>>;
	totalWeightG?: number;
	servings?: number;
	servingUnitText?: string;
}

export default function NutritionFactsLabel({ nutrients, totalWeightG = 0, servings = 1, servingUnitText }: NutritionFactsLabelProps) {
	const { theme } = useTheme();

	const perServing = useMemo(() => {
		const divisor = servings > 0 ? servings : 1;
		const result = {} as Record<keyof typeof NUTRIENT_NAME_TO_IDS, number>;

		// Iterate over key enum/map to guarantee default 0 values for all keys
		(Object.keys(NUTRIENT_NAME_TO_IDS) as Array<keyof typeof NUTRIENT_NAME_TO_IDS>).forEach((key) => {
			result[key] = (nutrients[key] ?? 0) / divisor;
		});

		return result;
	}, [nutrients, servings]);

	function pctDV(value: number, dv: number) {
		if (!dv || isNaN(value)) return 0;
		return Math.round((value / dv) * 100);
	}

	const styles = useMemo(
		() =>
			StyleSheet.create({
				box: { borderWidth: 2, borderColor: theme.text, borderRadius: 4, padding: 14, marginTop: 10 },
				title: { color: theme.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
				subLabel: { color: theme.textMuted, fontSize: 11, fontWeight: "700", marginTop: 4 },
				thickDivider: { height: 6, backgroundColor: theme.text, marginVertical: 8 },
				mediumDivider: { height: 3, backgroundColor: theme.text, marginVertical: 6 },
				thinDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginVertical: 5 },
				amountRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
				calLabel: { color: theme.text, fontSize: 20, fontWeight: "900" },
				calValue: { color: theme.text, fontSize: 34, fontWeight: "900" },
				nutrientRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
				indent1: { paddingLeft: 12 },
				indent2: { paddingLeft: 24 },
				boldText: { color: theme.text, fontSize: 13, fontWeight: "800" },
				normalText: { color: theme.text, fontSize: 13, fontWeight: "400" },
				dvText: { color: theme.text, fontSize: 13, fontWeight: "800" },
				footnote: { color: theme.textMuted, fontSize: 10, marginTop: 8, fontStyle: "italic" },
			}),
		[theme],
	);

	return (
		<View style={styles.box}>
			<Text style={styles.title}>Nutrition Facts</Text>
			<Text style={styles.subLabel}>
				{servingUnitText
					? `SERVING SIZE ${servingUnitText.toUpperCase()} (${Math.round(totalWeightG / (servings || 1))}G)`
					: `PER RECIPE (APPROX. ${Math.round(totalWeightG)}G)`}
			</Text>
			<View style={styles.thickDivider} />

			<Text style={styles.subLabel}>AMOUNT PER SERVING</Text>
			<View style={styles.amountRow}>
				<Text style={styles.calLabel}>Calories</Text>
				<Text style={styles.calValue}>{Math.round(perServing.ENERGY)}</Text>
			</View>
			<View style={styles.thickDivider} />

			<Text style={[styles.dvText, { textAlign: "right", marginBottom: 4 }]}>% Daily Value*</Text>
			<View style={styles.thinDivider} />

			{/* FAT BREAKDOWN */}
			<View style={styles.nutrientRow}>
				<Text style={styles.normalText}>
					<Text style={styles.boldText}>Total Fat</Text> {perServing.FAT.toFixed(1)}g
				</Text>
				<Text style={styles.dvText}>{pctDV(perServing.FAT, DV.fat)}%</Text>
			</View>
			<View style={styles.thinDivider} />

			<View style={[styles.nutrientRow, styles.indent1]}>
				<Text style={styles.normalText}>Saturated Fat {perServing.SATURATED_FAT.toFixed(1)}g</Text>
				<Text style={styles.dvText}>{pctDV(perServing.SATURATED_FAT, DV.saturated_fat)}%</Text>
			</View>
			<View style={styles.thinDivider} />

			<View style={[styles.nutrientRow, styles.indent1]}>
				<Text style={styles.normalText}>Trans Fat {perServing.TRANS_FAT.toFixed(1)}g</Text>
			</View>
			<View style={styles.thinDivider} />

			{/* CHOLESTEROL & SODIUM */}
			<View style={styles.nutrientRow}>
				<Text style={styles.normalText}>
					<Text style={styles.boldText}>Cholesterol</Text> {perServing.CHOLESTEROL.toFixed(0)}mg
				</Text>
				<Text style={styles.dvText}>{pctDV(perServing.CHOLESTEROL, DV.cholesterol)}%</Text>
			</View>
			<View style={styles.thinDivider} />

			<View style={styles.nutrientRow}>
				<Text style={styles.normalText}>
					<Text style={styles.boldText}>Sodium</Text> {perServing.SODIUM.toFixed(0)}mg
				</Text>
				<Text style={styles.dvText}>{pctDV(perServing.SODIUM, DV.sodium)}%</Text>
			</View>
			<View style={styles.thinDivider} />

			{/* CARB BREAKDOWN */}
			<View style={styles.nutrientRow}>
				<Text style={styles.normalText}>
					<Text style={styles.boldText}>Total Carbohydrate</Text> {perServing.CARBS.toFixed(1)}g
				</Text>
				<Text style={styles.dvText}>{pctDV(perServing.CARBS, DV.carbs)}%</Text>
			</View>
			<View style={styles.thinDivider} />

			<View style={[styles.nutrientRow, styles.indent1]}>
				<Text style={styles.normalText}>Dietary Fiber {perServing.FIBER.toFixed(1)}g</Text>
				<Text style={styles.dvText}>{pctDV(perServing.FIBER, DV.fiber)}%</Text>
			</View>
			<View style={styles.thinDivider} />

			<View style={[styles.nutrientRow, styles.indent1]}>
				<Text style={styles.normalText}>Total Sugars {perServing.SUGAR.toFixed(1)}g</Text>
			</View>
			<View style={styles.thinDivider} />

			<View style={[styles.nutrientRow, styles.indent2]}>
				<Text style={styles.normalText}>Includes {perServing.ADDED_SUGAR.toFixed(1)}g Added Sugars</Text>
				<Text style={styles.dvText}>{pctDV(perServing.ADDED_SUGAR, DV.added_sugar)}%</Text>
			</View>
			<View style={styles.thinDivider} />

			{/* PROTEIN */}
			<View style={styles.nutrientRow}>
				<Text style={styles.normalText}>
					<Text style={styles.boldText}>Protein</Text> {perServing.PROTEIN.toFixed(1)}g
				</Text>
				<Text style={styles.dvText}>{pctDV(perServing.PROTEIN, DV.protein)}%</Text>
			</View>
			<View style={styles.mediumDivider} />

			{/* VITAMINS & MINERALS */}
			<View style={styles.nutrientRow}>
				<Text style={styles.normalText}>Vitamin D {perServing.VITAMIN_D.toFixed(1)}mcg</Text>
				<Text style={styles.dvText}>{pctDV(perServing.VITAMIN_D, DV.vitamin_d)}%</Text>
			</View>
			<View style={styles.thinDivider} />

			<View style={styles.nutrientRow}>
				<Text style={styles.normalText}>Calcium {perServing.CALCIUM.toFixed(0)}mg</Text>
				<Text style={styles.dvText}>{pctDV(perServing.CALCIUM, DV.calcium)}%</Text>
			</View>
			<View style={styles.thinDivider} />

			<View style={styles.nutrientRow}>
				<Text style={styles.normalText}>Iron {perServing.IRON.toFixed(1)}mg</Text>
				<Text style={styles.dvText}>{pctDV(perServing.IRON, DV.iron)}%</Text>
			</View>
			<View style={styles.thinDivider} />

			<View style={styles.nutrientRow}>
				<Text style={styles.normalText}>Potassium {perServing.POTASSIUM.toFixed(0)}mg</Text>
				<Text style={styles.dvText}>{pctDV(perServing.POTASSIUM, DV.potassium)}%</Text>
			</View>
			<View style={styles.thinDivider} />

			<Text style={styles.footnote}>
				* The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general
				nutrition advice.
			</Text>
		</View>
	);
}
