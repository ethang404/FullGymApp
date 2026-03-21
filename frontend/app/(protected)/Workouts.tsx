import { router } from "expo-router";
import { SafeAreaView, View, Text, FlatList, StyleSheet, Pressable } from "react-native";
import { useMemo } from "react";
import { useTheme } from "@/theme/ThemeProvider";

const workouts = [
	{ id: "1", title: "Push Day", date: "2025-08-10", focus: "Chest, Shoulders, Triceps" },
	{ id: "2", title: "Pull Day", date: "2025-08-12", focus: "Back, Biceps" },
	{ id: "3", title: "Leg Day", date: "2025-08-14", focus: "Quads, Hamstrings, Glutes" },
];

export default function Workouts() {
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
					marginBottom: 4,
					color: theme.text,
				},
				subheading: {
					fontSize: 14,
					color: theme.textSecondary,
					marginBottom: 16,
				},
				list: {
					flex: 1,
				},
				card: {
					backgroundColor: theme.cardBg,
					borderRadius: 12,
					padding: 12,
					marginBottom: 10,
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					shadowColor: theme.shadowColor,
					shadowOffset: { width: 0, height: 2 },
					shadowOpacity: 0.06,
					shadowRadius: 4,
					elevation: 2,
				},
				title: {
					fontSize: 16,
					fontWeight: "600",
					color: theme.text,
				},
				meta: {
					fontSize: 12,
					color: theme.textTertiary,
					marginTop: 2,
				},
				date: {
					fontSize: 12,
					color: theme.textQuaternary,
				},
			}),
		[theme],
	);

	return (
		<SafeAreaView style={styles.container}>
			<Text style={styles.heading}>Your Workouts</Text>
			<Text style={styles.subheading}>Tap a workout to view or edit details</Text>

			<FlatList
				style={styles.list}
				data={workouts}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => (
					<Pressable onPress={() => router.push(`/(protected)/workouts/${item.id}`)}>
						<View style={styles.card}>
							<View>
								<Text style={styles.title}>{item.title}</Text>
								<Text style={styles.meta}>{item.focus}</Text>
							</View>
							<Text style={styles.date}>{item.date}</Text>
						</View>
					</Pressable>
				)}
			/>
		</SafeAreaView>
	);
}
