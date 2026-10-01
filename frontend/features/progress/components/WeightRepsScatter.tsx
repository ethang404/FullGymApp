import { View } from "react-native";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";
import { useTheme } from "@/theme/ThemeProvider";
import { niceScale } from "../format";
import type { LiftHistoryPoint } from "../types";

// Weight (y) against reps (x) for a lift's best set each workout. gifted-charts only has categorical x-axes,
// so this is drawn directly with react-native-svg. Newer sessions are drawn darker (and on top) so progress
// shows up as dots moving up and to the right over time.

const PAD = { top: 12, right: 12, bottom: 34, left: 40 };
const DOT_RADIUS = 6;
const HIT_RADIUS = 16; // bigger invisible target so small dots are easy to tap

interface Props {
	points: LiftHistoryPoint[]; // oldest first
	width: number;
	height?: number;
	selectedIndex: number | null;
	onSelect: (index: number) => void;
}

export function WeightRepsScatter({ points, width, height = 220, selectedIndex, onSelect }: Props) {
	const { theme } = useTheme();

	const reps = points.map((p) => p.reps);
	const weights = points.map((p) => p.weight);
	const xScale = niceScale(Math.min(...reps) - 1, Math.max(...reps) + 1, 5, { minStep: 1 });
	const yScale = niceScale(Math.min(...weights), Math.max(...weights), 4);

	const plotW = width - PAD.left - PAD.right;
	const plotH = height - PAD.top - PAD.bottom;
	const toX = (r: number) => PAD.left + ((r - xScale.min) / (xScale.max - xScale.min)) * plotW;
	const toY = (w: number) => PAD.top + plotH - ((w - yScale.min) / (yScale.max - yScale.min)) * plotH;

	const xTicks = Array.from({ length: xScale.sections + 1 }, (_, i) => xScale.min + i * xScale.step);
	const yTicks = Array.from({ length: yScale.sections + 1 }, (_, i) => yScale.min + i * yScale.step);
	const recency = (i: number) => (points.length === 1 ? 1 : i / (points.length - 1));

	return (
		<View>
			<Svg width={width} height={height}>
				{yTicks.map((tick) => (
					<G key={`y${tick}`}>
						<Line x1={PAD.left} x2={width - PAD.right} y1={toY(tick)} y2={toY(tick)} stroke={theme.borderLight} strokeWidth={1} />
						<SvgText x={PAD.left - 6} y={toY(tick) + 3} fontSize={10} fill={theme.textTertiary} textAnchor="end">
							{String(Math.round(tick * 10) / 10)}
						</SvgText>
					</G>
				))}
				{xTicks.map((tick) => (
					<SvgText key={`x${tick}`} x={toX(tick)} y={PAD.top + plotH + 14} fontSize={10} fill={theme.textTertiary} textAnchor="middle">
						{String(tick)}
					</SvgText>
				))}
				<Line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke={theme.border} strokeWidth={1} />
				<Line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + plotH} stroke={theme.border} strokeWidth={1} />
				<SvgText x={PAD.left + plotW / 2} y={height - 4} fontSize={10} fill={theme.textMuted} textAnchor="middle">
					Reps
				</SvgText>

				{points.map((p, i) => {
					const selected = i === selectedIndex;
					return (
						<G key={`${p.date}-${i}`} onPress={() => onSelect(i)}>
							<Circle cx={toX(p.reps)} cy={toY(p.weight)} r={HIT_RADIUS} fill="transparent" />
							<Circle
								cx={toX(p.reps)}
								cy={toY(p.weight)}
								r={selected ? DOT_RADIUS + 1.5 : DOT_RADIUS}
								fill={theme.primary}
								fillOpacity={0.2 + 0.8 * recency(i)}
								stroke={selected ? theme.text : theme.cardBg}
								strokeWidth={selected ? 2 : 1}
							/>
						</G>
					);
				})}
			</Svg>
		</View>
	);
}
