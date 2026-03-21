import { Text, View, StyleSheet, FlatList, Pressable, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useMemo } from "react";
import { router } from "expo-router";
import { Button } from "react-native-paper";
import { useTheme } from "@/theme/ThemeProvider";

export default function Home() {
	const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
	const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
	const today = new Date();
	const dayName = days[today.getDay()];

	const { theme } = useTheme();

	const styles = useMemo(
		() =>
			StyleSheet.create({
				container: {
					flex: 1,
					backgroundColor: theme.background,
				},

				InnerHeader: {
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					paddingBottom: 20,
				},
				workoutCard: {
					borderRadius: 20,
					padding: 20,
					marginHorizontal: 16,
					marginVertical: 8,
					backgroundColor: theme.primary,
				},
				//Split workout card into [text] [Button] like our header area
				InnerWorkoutCard: {
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
				},
				//targeting left [text] area
				workoutCardTextBlock: {
					flex: 1,
					marginRight: 12,
				},

				//applying sylization to the [text] section
				workoutCardLabel: {
					fontSize: 11,
					fontWeight: "600",
					color: theme.textInverse,
					letterSpacing: 1.2,
					textTransform: "uppercase",
					marginBottom: 8,
					opacity: 0.7,
				},
				workoutCardTitle: {
					fontSize: 26,
					fontWeight: "700",
					color: theme.textInverse,
					marginBottom: 4,
				},
				workoutCardSubtitle: {
					fontSize: 13,
					color: theme.textInverse,
					opacity: 0.75,
				},

				//[button] section
				workoutStartButton: {
					backgroundColor: "rgba(0,0,0,0.15)",
					borderRadius: 50,
					paddingVertical: 10,
					paddingHorizontal: 18,
					borderWidth: 1,
					borderColor: "rgba(255,255,255,0.25)",
				},
				workoutStartButtonText: {
					color: theme.textInverse,
					fontWeight: "600",
					fontSize: 14,
				},
			}),
		[theme],
	);

	return (
		<SafeAreaView style={styles.container}>
			<ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
				<View style={styles.InnerHeader}>
					<View>
						<Text
							style={{
								color: theme.textMuted,
								fontSize: 12,
								letterSpacing: 1.2,
								textTransform: "uppercase",
								marginBottom: 4,
							}}
						>
							{dayName}, {months[today.getMonth()]} {today.getDate()}
						</Text>
						<Text
							style={{
								color: theme.text,
								fontSize: 24,
								fontWeight: "700",
							}}
						>
							Good morning 👋
						</Text>
					</View>

					<View
						style={{
							width: 40,
							height: 40,
							borderRadius: 20,
							backgroundColor: theme.primary,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>J</Text>
					</View>
				</View>

				<View style={styles.workoutCard}>
					<Text style={styles.workoutCardLabel}>TODAY'S WORKOUT</Text>

					<View style={styles.InnerWorkoutCard}>
						<View style={styles.workoutCardTextBlock}>
							<Text style={styles.workoutCardTitle}>Push Day</Text>
							<Text style={styles.workoutCardSubtitle}>Chest · Shoulders · Triceps</Text>
						</View>

						<TouchableOpacity style={styles.workoutStartButton}>
							<Text style={styles.workoutStartButtonText}>Start →</Text>
						</TouchableOpacity>
					</View>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}
