import { useLocalSearchParams } from "expo-router";
import { View, Text, StyleSheet, TextInput, SafeAreaView } from "react-native";
import { Card, DataTable } from "react-native-paper";

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

const ExerciseCard = ({ exercise }) => {
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
					<Text>Notes</Text>
					<TextInput
						placeholder={exercise.notes}
						style={{
							marginTop: 6,
							padding: 10,
							borderRadius: 12,
							borderWidth: 1,
							borderColor: "#ddd",
							backgroundColor: "#fafafa",
						}}
					/>
				</View>
			</Card.Content>
		</Card>
	);
};

export default function Workout() {
	const { id } = useLocalSearchParams();

	return (
		<SafeAreaView style={styles.container}>
			{workouts.map((exercise) => (
				<ExerciseCard key={exercise.id} exercise={exercise} />
			))}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
});
