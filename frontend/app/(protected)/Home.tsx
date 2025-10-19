import { Text, View, StyleSheet, SafeAreaView, FlatList, Pressable } from "react-native";
import { useState } from "react";
import { Button } from "react-native-paper";
//import { Card, Button, Text } from "react-native-paper";

export default function Home() {
	const workouts = [
		{ id: "1", title: "Push Day", date: "2025-08-10" },
		{ id: "2", title: "Pull Day", date: "2025-08-12" },
		{ id: "3", title: "Leg Day", date: "2025-08-14" },
		{ id: "4", title: "Push Day", date: "2025-08-10" },
		{ id: "5", title: "Pull Day", date: "2025-08-12" },
		{ id: "6", title: "Leg Day", date: "2025-08-14" },
		{ id: "7", title: "Push Day", date: "2025-08-10" },
		{ id: "8", title: "Pull Day", date: "2025-08-12" },
		{ id: "9", title: "Leg Day", date: "2025-08-14" },
		{ id: "10", title: "Push Day", date: "2025-08-10" },
		{ id: "11", title: "Pull Day", date: "2025-08-12" },
		{ id: "12", title: "Leg Day", date: "2025-08-14" },
	];

	const widgetPages = [
		{
			title: "Overview",
			data: {
				totalWorkouts: 12,
				totalSets: 145,
				avgDuration: "1h 15m",
				lastWorkout: "2025-10-10",
			},
		},
		{
			title: "Volume",
			data: {
				totalWeightLifted: "42,500 lbs",
				avgPerWorkout: "3,540 lbs",
				bestDay: "2025-10-09",
			},
		},
		{
			title: "PRs",
			data: {
				benchPress: "225 lbs",
				squat: "315 lbs",
				deadlift: "365 lbs",
				bestLift: "Deadlift",
			},
		},
	];

	const [pageIndex, setPageIndex] = useState(0);
	const page = widgetPages[pageIndex];

	return (
		<SafeAreaView style={styles.container}>
			{/* Active workout pill */}
			<View style={styles.activeWork}>
				<Text style={styles.activeWorkoutText}>Active Workout</Text>
			</View>

			<View style={widget.container}>
				<View style={widget.filters}>
					<Button>Week</Button>
					<Button>Month</Button>
					<Button>Year</Button>
					<Button>All</Button>
				</View>
				<Text style={widget.title}>Workout at a Glance</Text>
				<View style={widget.content}>
					{Object.entries(page.data).map(([key, value]) => (
						<Text key={key} style={widget.text}>
							{key}: {value}
						</Text>
					))}
				</View>

				<View style={widget.dots}>
					{widgetPages.map((_, idx) => (
						<Text
							key={idx}
							style={[widget.dot, idx === pageIndex && widget.activeDot]}
							onPress={() => setPageIndex(idx)}
						>
							•
						</Text>
					))}
				</View>
			</View>

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

const widget = StyleSheet.create({
	container: {
		backgroundColor: "#EBE8E2",
		borderRadius: 10,
		borderWidth: 1,
		borderColor: "#ccc",
		padding: 0,
		marginVertical: 10,
		width: "90%",
		alignSelf: "center",
	},
	filters: {
		flexDirection: "row",
		justifyContent: "space-around",
		marginBottom: 10,
	},
	title: {
		fontSize: 18,
		alignSelf: "center",
		paddingBottom: 30,
	},
	content: {
		marginBottom: 20,
	},
	text: {
		fontSize: 14,
		marginBottom: 5,
	},
	dots: {
		flexDirection: "row",
		justifyContent: "center",
	},
	dot: {
		fontSize: 28,
		color: "#aaa",
		marginHorizontal: 4,
	},
	activeDot: {
		color: "#007AFF",
	},
});

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
