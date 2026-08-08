import { useLocalSearchParams } from "expo-router";
import { View, Text, StyleSheet, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useMemo } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Card, DataTable } from "react-native-paper";
import { useTheme } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/colors";

import { instance } from "@/utils/AxiosInterceptorHandler";

export default function Workout() {
	const { workout_id, mode } = useLocalSearchParams<{
		workout_id?: string; //this will have a value if we're editing an existing workout or copying to create a new one
		mode: "new" | "edit" | "copy"; //what operation we're doing
	}>();

	useEffect(() => {
		if ((mode === "edit" || mode === "copy") && workout_id != null) {
			const getWorkoutData = async () => {
				try {
					const resp = await instance.get(`/nutrition/workouts/${workout_id}`);
				} catch (err) {
					console.error(err);
				}
			};

			getWorkoutData();
		}
	}, [mode, workout_id]);
}
