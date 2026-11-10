import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useMemo } from "react";
import { router } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/typography";
import { ScreenState } from "@/components/ScreenState";
import { PressableScale } from "@/components/PressableScale";
import Screen from "@/components/Screen";

import { useWorkouts } from "@/features/workouts/hooks/useWorkouts";
import { WorkoutListCard } from "@/features/workouts/components/WorkoutListCard";

export default function Workouts() {
	const { theme } = useTheme();
	const list = useWorkouts();

	const goToNewWorkout = () => router.push({ pathname: "/(protected)/workouts/[workout_id]", params: { workout_id: "new", mode: "new" } });

	const styles = useMemo(
		() =>
			StyleSheet.create({
				scroll: { flex: 1 },
				content: { padding: 16, paddingBottom: 32, gap: 12 },

				header: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: 8,
				},
				pageTitle: {
					fontSize: 28,
					lineHeight: 34,
					fontFamily: fonts.headingHeavy,
					color: theme.text,
				},

				//Start workout btn stuff
				ctaBanner: {
					backgroundColor: theme.cardBg,
					borderRadius: 16,
					padding: 20,
					borderWidth: 1,
					borderColor: theme.border,
					marginBottom: 4,
				},
				ctaTitle: {
					fontSize: 22,
					lineHeight: 28,
					fontFamily: fonts.heading,
					color: theme.text,
					marginBottom: 6,
				},
				ctaSub: {
					fontSize: 13,
					color: theme.textMuted,
					marginBottom: 16,
					lineHeight: 19,
				},
				ctaButton: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "center",
					gap: 8,
					backgroundColor: theme.primary,
					borderRadius: 12,
					paddingVertical: 14,
				},
				ctaButtonText: {
					fontSize: 15,
					fontWeight: "700",
					color: theme.textInverse,
				},

				sectionLabel: {
					fontSize: 15,
					fontWeight: "700",
					color: theme.textSecondary,
					marginBottom: 8,
					marginTop: 4,
				},

				emptyState: {
					alignItems: "center",
					paddingVertical: 40,
					gap: 8,
				},
				emptyTitle: {
					fontSize: 16,
					fontWeight: "700",
					color: theme.textMuted,
				},
				emptySubtitle: {
					fontSize: 13,
					color: theme.textTertiary,
					textAlign: "center",
				},
			}),
		[theme],
	);

	const listHeader = (
		<>
			<View style={styles.header}>
				<Text style={styles.pageTitle}>Workouts</Text>
			</View>

			<View style={styles.ctaBanner}>
				<Text style={styles.ctaTitle}>Ready when you are</Text>
				<Text style={styles.ctaSub}>Log each set as you go and we&apos;ll keep track of the rest.</Text>
				<PressableScale style={styles.ctaButton} onPress={goToNewWorkout}>
					<FontAwesome5 name="play" size={12} color={theme.textInverse} />
					<Text style={styles.ctaButtonText}>Start workout</Text>
				</PressableScale>
			</View>

			{list.workouts.length > 0 && <Text style={styles.sectionLabel}>Past workouts</Text>}
		</>
	);

	return (
		<Screen edges={["top"]}>
			<ScreenState loading={list.loading} error={list.error} onRetry={list.refetch} errorTitle="Couldn't load your workouts">
				<FlatList
					data={list.workouts}
					keyExtractor={(w) => w.id}
					renderItem={({ item }) => (
						<WorkoutListCard
							workout={item}
							onPress={() => router.push({ pathname: "/(protected)/workouts/[workout_id]", params: { workout_id: item.id, mode: "edit" } })}
						/>
					)}
					ListHeaderComponent={listHeader}
					ListEmptyComponent={
						<View style={styles.emptyState}>
							<FontAwesome5 name="dumbbell" size={32} color={theme.textTertiary} />
							<Text style={styles.emptyTitle}>No workouts yet</Text>
							<Text style={styles.emptySubtitle}>Tap Start workout to log your first one.</Text>
						</View>
					}
					style={styles.scroll}
					contentContainerStyle={styles.content}
					showsVerticalScrollIndicator={false}
					refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={theme.primary} />}
				/>
			</ScreenState>
		</Screen>
	);
}
