import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";

// Shared circular progress ring (SVG-based). Originally hand-rolled inside
// Home.tsx; promoted here so Home, Nutrition, and Progress can all use the
// same ring without duplicating the math.
export function RingProgress({
	percent,
	size = 72,
	strokeWidth = 7,
	color,
	trackColor,
	label,
}: {
	percent: number;
	size?: number;
	strokeWidth?: number;
	color: string;
	trackColor: string;
	label?: string;
}) {
	const clamped = Math.max(0, Math.min(percent, 100));
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const dashOffset = circumference * (1 - clamped / 100);
	const center = size / 2;

	return (
		<View style={{ alignItems: "center", gap: 4 }}>
			<View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
				<Svg width={size} height={size} style={{ position: "absolute" }}>
					<Circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
					<Circle
						cx={center}
						cy={center}
						r={radius}
						stroke={color}
						strokeWidth={strokeWidth}
						fill="none"
						strokeDasharray={circumference}
						strokeDashoffset={dashOffset}
						strokeLinecap="round"
						transform={`rotate(-90 ${center} ${center})`}
					/>
				</Svg>
				<Text style={{ fontSize: 13, fontWeight: "700", color }}>{Math.round(clamped)}%</Text>
			</View>
			{label ? <Text style={{ fontSize: 11, color, fontWeight: "600", letterSpacing: 0.5 }}>{label}</Text> : null}
		</View>
	);
}
