import { SafeAreaView, View, Text, StyleSheet, TextInput } from "react-native";
import { useMemo } from "react";
import { KeyboardAwareFlatList } from "react-native-keyboard-aware-scroll-view";
import { useTheme } from "@/theme/ThemeProvider";

const mockSummary = {
	calories: 2150,
	protein: 145,
	carbs: 190,
	fat: 70,
};

const mockMeals = [
	{ id: "1", name: "Breakfast", detail: "Oats, berries, whey", calories: 550 },
	{ id: "2", name: "Lunch", detail: "Chicken, rice, broccoli", calories: 700 },
	{ id: "3", name: "Snack", detail: "Greek yogurt, almonds", calories: 300 },
	{ id: "4", name: "Dinner", detail: "Salmon, potatoes, salad", calories: 600 },
];

export default function Nutrition() {
	const { theme } = useTheme();

	const styles = useMemo(
		() =>
			StyleSheet.create({
				container: {
					flex: 1,
					backgroundColor: theme.background,
					padding: 16,
				},
				heading: {
					fontSize: 24,
					fontWeight: "700",
					marginBottom: 12,
					color: theme.text,
				},
				summaryCard: {
					backgroundColor: theme.cardBg,
					borderRadius: 12,
					padding: 14,
					marginBottom: 16,
					shadowColor: theme.shadowColor,
					shadowOffset: { width: 0, height: 2 },
					shadowOpacity: 0.06,
					shadowRadius: 4,
					elevation: 2,
				},
				summaryTitle: {
					fontSize: 16,
					fontWeight: "600",
					marginBottom: 8,
					color: theme.text,
				},
				summaryRow: {
					flexDirection: "row",
					justifyContent: "space-between",
					marginBottom: 4,
				},
				summaryLabel: {
					fontSize: 14,
					color: theme.textSecondary,
				},
				summaryValue: {
					fontSize: 14,
					fontWeight: "600",
					color: theme.text,
				},
				sectionHeading: {
					fontSize: 18,
					fontWeight: "600",
					marginBottom: 8,
					color: theme.text,
				},
				mealCard: {
					flexDirection: "row",
					alignItems: "center",
					backgroundColor: theme.cardBg,
					borderRadius: 12,
					padding: 12,
					marginBottom: 8,
					shadowColor: theme.shadowColor,
					shadowOffset: { width: 0, height: 1 },
					shadowOpacity: 0.05,
					shadowRadius: 3,
					elevation: 1,
				},
				mealTitle: {
					fontSize: 15,
					fontWeight: "600",
					color: theme.text,
				},
				mealDetail: {
					fontSize: 12,
					color: theme.textTertiary,
					marginTop: 2,
				},
				mealCalories: {
					fontSize: 14,
					fontWeight: "600",
					color: theme.text,
					marginLeft: 12,
				},
				logBox: {
					marginTop: 8,
				},
				logLabel: {
					fontSize: 14,
					fontWeight: "500",
					marginBottom: 4,
					color: theme.text,
				},
				logInput: {
					backgroundColor: theme.inputBg,
					borderRadius: 10,
					padding: 10,
					borderWidth: 1,
					borderColor: theme.inputBorder,
					color: theme.text,
				},
			}),
		[theme],
	);

	return (
		<KeyboardAwareFlatList
			style={{ flex: 1, backgroundColor: theme.background }}
			contentContainerStyle={styles.container}
			enableOnAndroid
			extraScrollHeight={40}
			keyboardShouldPersistTaps="handled"
			data={mockMeals}
			keyExtractor={(item) => item.id}
			ListHeaderComponent={
				<SafeAreaView>
					<Text style={styles.heading}>Today&apos;s Nutrition</Text>

					<View style={styles.summaryCard}>
						<Text style={styles.summaryTitle}>Summary</Text>
						<View style={styles.summaryRow}>
							<Text style={styles.summaryLabel}>Calories</Text>
							<Text style={styles.summaryValue}>{mockSummary.calories}</Text>
						</View>
						<View style={styles.summaryRow}>
							<Text style={styles.summaryLabel}>Protein (g)</Text>
							<Text style={styles.summaryValue}>{mockSummary.protein}</Text>
						</View>
						<View style={styles.summaryRow}>
							<Text style={styles.summaryLabel}>Carbs (g)</Text>
							<Text style={styles.summaryValue}>{mockSummary.carbs}</Text>
						</View>
						<View style={styles.summaryRow}>
							<Text style={styles.summaryLabel}>Fat (g)</Text>
							<Text style={styles.summaryValue}>{mockSummary.fat}</Text>
						</View>
					</View>

					<View style={styles.logBox}>
						<Text style={styles.logLabel}>Quick add</Text>
						<TextInput placeholder="e.g. 200 kcal snack" style={styles.logInput} />
					</View>

					<Text style={styles.sectionHeading}>Meals</Text>
				</SafeAreaView>
			}
			renderItem={({ item }) => (
				<View style={styles.mealCard}>
					<View style={{ flex: 1 }}>
						<Text style={styles.mealTitle}>{item.name}</Text>
						<Text style={styles.mealDetail}>{item.detail}</Text>
					</View>
					<Text style={styles.mealCalories}>{item.calories} kcal</Text>
				</View>
			)}
		/>
	);
}
