import { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useTheme } from "@/theme/ThemeProvider";

interface SliderProps {
	min: number;
	max: number;
	step: number;
	/** null = nothing picked yet: the thumb sits in the middle, dimmed, with no fill. */
	value: number | null;
	onChange: (value: number) => void;
	accessibilityLabel: string;
	/** How screen readers announce the value, e.g. 71 -> `5 feet 11 inches`. */
	formatValue?: (value: number) => string;
}

const THUMB = 22;
const TRACK = 6;
const HIT_HEIGHT = 36;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// A horizontal slider. Drag or tap anywhere on the track. A drag only starts after
// a small sideways move, so a vertical swipe that begins on it still scrolls the page.
export default function Slider({ min, max, step, value, onChange, accessibilityLabel, formatValue = String }: SliderProps) {
	const { theme } = useTheme();
	const [width, setWidth] = useState(0);

	const shown = clamp(value ?? (min + max) / 2, min, max);
	const thumbLeft = width > THUMB ? ((shown - min) / (max - min)) * (width - THUMB) : 0;

	function setFromX(x: number) {
		if (width <= THUMB) return;
		const ratio = clamp((x - THUMB / 2) / (width - THUMB), 0, 1);
		const stepped = Math.round((ratio * (max - min)) / step) * step + min;
		const next = clamp(Number(stepped.toFixed(4)), min, max);
		if (next !== value) onChange(next);
	}

	function nudge(direction: 1 | -1) {
		const base = value ?? Math.round((min + max) / 2 / step) * step;
		onChange(clamp(Number((base + direction * step).toFixed(4)), min, max));
	}

	const pan = Gesture.Pan()
		.runOnJS(true)
		.activeOffsetX([-4, 4])
		.failOffsetY([-12, 12])
		.onStart((e) => setFromX(e.x))
		.onUpdate((e) => setFromX(e.x));
	const tap = Gesture.Tap()
		.runOnJS(true)
		.onEnd((e) => setFromX(e.x));

	const styles = useMemo(
		() =>
			StyleSheet.create({
				hit: { height: HIT_HEIGHT, justifyContent: "center" },
				track: {
					height: TRACK,
					marginHorizontal: THUMB / 2,
					borderRadius: TRACK / 2,
					backgroundColor: theme.cardBgAlt,
					overflow: "hidden",
				},
				fill: { height: TRACK, backgroundColor: theme.primary },
				thumb: {
					position: "absolute",
					top: (HIT_HEIGHT - THUMB) / 2,
					width: THUMB,
					height: THUMB,
					borderRadius: THUMB / 2,
					borderWidth: 3,
					borderColor: theme.cardBg,
				},
			}),
		[theme],
	);

	return (
		<GestureDetector gesture={Gesture.Race(pan, tap)}>
			<View
				style={styles.hit}
				onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
				accessible
				accessibilityRole="adjustable"
				accessibilityLabel={accessibilityLabel}
				accessibilityValue={{ text: value == null ? "Not set" : formatValue(value) }}
				accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
				onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === "increment" ? 1 : -1)}
			>
				<View style={styles.track}>{value != null && <View style={[styles.fill, { width: thumbLeft }]} />}</View>
				<View style={[styles.thumb, { left: thumbLeft, backgroundColor: value == null ? theme.textTertiary : theme.primary }]} />
			</View>
		</GestureDetector>
	);
}
