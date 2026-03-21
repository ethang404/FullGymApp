import { useLocalSearchParams } from "expo-router";
import { View, Text, StyleSheet, TextInput, SafeAreaView, ScrollView } from "react-native";
import { useMemo } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Card, DataTable } from "react-native-paper";
import { useTheme } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/colors";

const workouts = [
	{
		id: "1",
		name: "Bench Press",
		notes: "Focus on slow negatives.",
		sets: [
			{ reps: 10, weight: 135 },
			{ reps: 8, weight: 155 },
			{ reps: 6, weight: 175 },
		],
	},
	{
		id: "2",
		name: "Squats",
		notes: "Keep core tight, watch depth.",
		sets: [
			{ reps: 12, weight: 185 },
			{ reps: 10, weight: 205 },
			{ reps: 8, weight: 225 },
		],
	},
	{
		id: "3",
		name: "Pull-Ups",
		notes: "Full range of motion.",
		sets: [
			{ reps: 12, weight: "Bodyweight" },
			{ reps: 10, weight: "Bodyweight" },
			{ reps: 8, weight: "Bodyweight + 10 lbs" },
		],
	},
];

const ExerciseCard = ({ exercise, theme }: { exercise: (typeof workouts)[0]; theme: Theme }) => {
	return (
		<Card style={{ marginBottom: 16, borderRadius: 16, elevation: 4 }}>
			<Card.Title title={exercise.name} />
			<Card.Content>
				<DataTable>
					<DataTable.Header>
						<DataTable.Title>Set</DataTable.Title>
						<DataTable.Title>Reps</DataTable.Title>
						<DataTable.Title>Weight</DataTable.Title>
					</DataTable.Header>

					{exercise.sets.map((set, i) => (
						<DataTable.Row key={i}>
							<DataTable.Cell>{i + 1}</DataTable.Cell>
							<DataTable.Cell>{set.reps}</DataTable.Cell>
							<DataTable.Cell>{set.weight}</DataTable.Cell>
						</DataTable.Row>
					))}
				</DataTable>

				<View style={{ marginTop: 12 }}>
					<Text style={{ color: theme.text }}>Notes</Text>
					<TextInput
						placeholder={exercise.notes}
						placeholderTextColor={theme.inputPlaceholder}
						style={{
							marginTop: 6,
							padding: 10,
							borderRadius: 12,
							borderWidth: 1,
							borderColor: theme.inputBorder,
							backgroundColor: theme.inputBg,
							color: theme.text,
						}}
					/>
				</View>
			</Card.Content>
		</Card>
	);
};

export default function Workout() {
	const { id } = useLocalSearchParams();
	const { theme } = useTheme();

	const styles = useMemo(
		() =>
			StyleSheet.create({
				container: {
					flex: 1,
					backgroundColor: theme.background,
					padding: 16,
				},
				scrollContent: {
					paddingBottom: 24,
				},
			}),
		[theme],
	);

	return (
		<KeyboardAwareScrollView
			style={{ flex: 1, backgroundColor: theme.background }}
			contentContainerStyle={styles.scrollContent}
			enableOnAndroid
			extraScrollHeight={40}
			keyboardShouldPersistTaps="handled"
		>
			<SafeAreaView style={styles.container}>
				<ScrollView>
					{workouts.map((exercise) => (
						<ExerciseCard key={exercise.id} exercise={exercise} theme={theme} />
					))}
				</ScrollView>
			</SafeAreaView>
		</KeyboardAwareScrollView>
	);
}
