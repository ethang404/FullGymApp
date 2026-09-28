import { useEffect, useMemo } from "react";
import { Modal, View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withSpring,
	withTiming,
	Easing,
	type SharedValue,
} from "react-native-reanimated";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/typography";

// The app's one celebration moment: shown after a new workout is saved.
// A badge springs in and a ring of dots bursts out once. With Reduce Motion
// on, the badge just appears and the burst is skipped.

const DOTS = 10;
const BURST_RADIUS = 78;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function BurstDot({ index, progress, color }: { index: number; progress: SharedValue<number>; color: string }) {
	const angle = (index / DOTS) * Math.PI * 2;
	const style = useAnimatedStyle(() => ({
		opacity: progress.value < 0.05 ? 0 : 1 - progress.value,
		transform: [
			{ translateX: Math.cos(angle) * BURST_RADIUS * progress.value },
			{ translateY: Math.sin(angle) * BURST_RADIUS * progress.value },
			{ scale: 1 - progress.value * 0.4 },
		],
	}));
	return <Animated.View style={[burstStyles.dot, { backgroundColor: color }, style]} />;
}

export function WorkoutCelebration({
	visible,
	exerciseCount,
	setCount,
	onDone,
}: {
	visible: boolean;
	exerciseCount: number;
	setCount: number;
	onDone: () => void;
}) {
	const { theme } = useTheme();
	const reduceMotion = useReducedMotion();
	const badgeScale = useSharedValue(0);
	const burst = useSharedValue(0);

	useEffect(() => {
		if (!visible) {
			badgeScale.value = 0;
			burst.value = 0;
			return;
		}
		if (reduceMotion) {
			badgeScale.value = 1;
			return;
		}
		badgeScale.value = withSpring(1, { damping: 9, stiffness: 180 });
		burst.value = withDelay(120, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
	}, [visible, reduceMotion, badgeScale, burst]);

	const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.value }] }));

	const styles = useMemo(
		() =>
			StyleSheet.create({
				overlay: { flex: 1, backgroundColor: theme.overlay, alignItems: "center", justifyContent: "center", padding: 24 },
				card: {
					width: "100%",
					maxWidth: 340,
					backgroundColor: theme.cardBg,
					borderRadius: 28,
					paddingTop: 40,
					paddingBottom: 24,
					paddingHorizontal: 24,
					alignItems: "center",
				},
				badgeWrap: { width: 96, height: 96, alignItems: "center", justifyContent: "center", marginBottom: 20 },
				badge: {
					width: 96,
					height: 96,
					borderRadius: 48,
					backgroundColor: theme.accent,
					alignItems: "center",
					justifyContent: "center",
				},
				title: { fontSize: 30, lineHeight: 36, fontFamily: fonts.headingHeavy, color: theme.text, textAlign: "center" },
				body: { fontSize: 15, color: theme.textMuted, textAlign: "center", marginTop: 6 },
				button: {
					alignSelf: "stretch",
					backgroundColor: theme.primary,
					borderRadius: 14,
					paddingVertical: 15,
					alignItems: "center",
					marginTop: 28,
				},
				buttonText: { color: theme.textInverse, fontSize: 16, fontWeight: "700" },
			}),
		[theme],
	);

	// Badge icon must stay legible on the accent fill in every theme (Midnight's accent is white).
	const iconColor = theme.accent.toUpperCase() === "#FFFFFF" ? "#000000" : theme.text;

	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
			<Pressable style={styles.overlay} onPress={onDone} accessibilityLabel="Close">
				<Pressable style={styles.card} accessibilityViewIsModal>
					<View style={styles.badgeWrap}>
						{!reduceMotion && Array.from({ length: DOTS }, (_, i) => <BurstDot key={i} index={i} progress={burst} color={i % 2 ? theme.accent : theme.primary} />)}
						<Animated.View style={[styles.badge, badgeStyle]}>
							<FontAwesome5 name="check" size={38} color={iconColor} />
						</Animated.View>
					</View>
					<Text style={styles.title} accessibilityRole="header">
						Workout saved
					</Text>
					<Text style={styles.body}>
						{plural(exerciseCount, "exercise")} and {plural(setCount, "set")} logged. Nice work.
					</Text>
					<Pressable style={styles.button} onPress={onDone} accessibilityRole="button">
						<Text style={styles.buttonText}>Done</Text>
					</Pressable>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const burstStyles = StyleSheet.create({
	dot: { position: "absolute", width: 10, height: 10, borderRadius: 5 },
});
