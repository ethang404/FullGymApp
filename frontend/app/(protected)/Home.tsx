import { Text, View, StyleSheet, SafeAreaView, FlatList, Pressable } from "react-native";

export default function Home() {
	const workouts = [
		{ id: "1", title: "Push Day", date: "2025-08-10" },
		{ id: "2", title: "Pull Day", date: "2025-08-12" },
		{ id: "3", title: "Leg Day", date: "2025-08-14" },
	];

	return (
		<SafeAreaView style={styles.container}>
			{/* Active workout pill */}
			<View style={styles.activeWork}>
				<Text style={styles.activeWorkoutText}>Active Workout</Text>
			</View>

			{/* Scrollable workout list */}
			<FlatList
				style={styles.list}
				data={workouts}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => (
					<Pressable onPress={() => console.log("Pressed:", item.title)}>
						<View style={styles.workoutItem}>
							<Text style={styles.workoutTitle}>{item.title}</Text>
							<Text style={styles.workoutDate}>{item.date}</Text>
						</View>
					</Pressable>
				)}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		backgroundColor: "#ecf0f1",
		padding: 8,
	},
	activeWork: {
		borderRadius: 99,
		backgroundColor: "#ADD8E6",
		paddingVertical: 8,
		paddingHorizontal: 16,
		marginVertical: 20,
	},
	activeWorkoutText: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#000",
	},

	list: {
		flex: 1,
		width: "100%",
		paddingHorizontal: 8,
	},
	workoutItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		backgroundColor: "#fff",
		borderRadius: 8,
		padding: 12,
		marginVertical: 6,

		// shadow for iOS
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		// shadow for Android
		elevation: 2,
	},
	workoutTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
	},
	workoutDate: {
		fontSize: 12,
		color: "#666",
	},
});
