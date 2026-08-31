import { Modal, View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Dimensions } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { LineChart } from "react-native-gifted-charts";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";

interface ExerciseHistoryPoint {
	date: string;
	value?: number;
	weight?: number;
	reps?: number;
}

interface ExerciseHistoryResponse {
	catalog_id: number;
	name: string | null;
	muscle_group: string | null;
	data: ExerciseHistoryPoint[];
}

interface ExerciseHistoryModalProps {
	visible: boolean;
	onClose: () => void;
	catalogId: number | null;
	name: string;
	filter: "week" | "month" | "year" | "all";
}

function formatShortDate(dateStr: string) {
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return "";
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Drill-in view for a single exercise's estimated-1RM history over time,
// opened by tapping a row in the Biggest Changes or Personal Records
// sections. Fetches GET /workouts/catalog/:id/history?epley=true fresh
// whenever it's opened for a (possibly different) catalog_id.
export function ExerciseHistoryModal({ visible, onClose, catalogId, name, filter }: ExerciseHistoryModalProps) {
	const { theme } = useTheme();
	const [loading, setLoading] = useState(true);
	const [history, setHistory] = useState<ExerciseHistoryResponse | null>(null);
	// Tracks the most recently-issued request so a slow, now-stale response (e.g. the user reopened the
	// modal for a different exercise before the first one finished) can't clobber newer state.
	const requestIdRef = useRef(0);

	async function loadHistory(id: number, activeFilter: ExerciseHistoryModalProps["filter"]) {
		const requestId = ++requestIdRef.current;
		setLoading(true);
		setHistory(null);

		try {
			const res = await instance.get(`/workouts/catalog/${id}/history`, { params: { filter: activeFilter, epley: "true" } });
			if (requestIdRef.current === requestId) setHistory(res.data ?? null);
		} catch (e) {
			console.error("Exercise history fetch error:", e);
		} finally {
			if (requestIdRef.current === requestId) setLoading(false);
		}
	}

	useEffect(() => {
		if (!visible || catalogId === null) return;
		loadHistory(catalogId, filter);
	}, [visible, catalogId, filter]);

	const styles = useMemo(
		() =>
			StyleSheet.create({
				overlay: {
					flex: 1,
					backgroundColor: theme.overlay,
					justifyContent: "flex-end",
				},
				sheet: {
					backgroundColor: theme.cardBg,
					borderTopLeftRadius: 20,
					borderTopRightRadius: 20,
					paddingTop: 16,
					paddingBottom: 32,
					maxHeight: "75%",
				},
				header: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					paddingHorizontal: 20,
					marginBottom: 12,
				},
				title: {
					fontSize: 17,
					fontWeight: "800",
					color: theme.text,
					flexShrink: 1,
				},
				closeButton: {
					width: 32,
					height: 32,
					borderRadius: 16,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: theme.cardBgAlt,
				},
				body: { paddingHorizontal: 12, minHeight: 200, justifyContent: "center" },
				emptyState: { alignItems: "center", paddingVertical: 40, gap: 8 },
				emptyText: { fontSize: 13, color: theme.textTertiary, textAlign: "center" },
			}),
		[theme],
	);

	const chartData = useMemo(() => {
		if (!history?.data?.length) return [];
		return history.data.map((point) => ({
			value: point.value ?? point.weight ?? 0,
			label: formatShortDate(point.date),
			dataPointColor: theme.primary,
		}));
	}, [history, theme]);

	const chartWidth = Dimensions.get("window").width - 64;

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<Pressable style={styles.overlay} onPress={onClose}>
				<Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
					<View style={styles.header}>
						<Text style={styles.title} numberOfLines={1}>
							{name}
						</Text>
						<Pressable style={styles.closeButton} onPress={onClose}>
							<FontAwesome5 name="times" size={14} color={theme.textSecondary} />
						</Pressable>
					</View>

					<ScrollView contentContainerStyle={styles.body}>
						{loading ? (
							<ActivityIndicator color={theme.primary} />
						) : chartData.length === 0 ? (
							<View style={styles.emptyState}>
								<FontAwesome5 name="chart-line" size={26} color={theme.textTertiary} />
								<Text style={styles.emptyText}>Not enough logged sets yet to chart this exercise.</Text>
							</View>
						) : (
							<LineChart
								data={chartData}
								width={chartWidth}
								height={200}
								color={theme.primary}
								thickness={2.5}
								curved
								areaChart
								startFillColor={theme.primary}
								startOpacity={0.25}
								endOpacity={0.02}
								yAxisTextStyle={{ color: theme.textTertiary, fontSize: 10 }}
								xAxisLabelTextStyle={{ color: theme.textTertiary, fontSize: 10 }}
								xAxisColor={theme.border}
								yAxisColor={theme.border}
								rulesColor={theme.borderLight}
								rotateLabel
								noOfSections={4}
								initialSpacing={16}
								endSpacing={16}
							/>
						)}
					</ScrollView>
				</Pressable>
			</Pressable>
		</Modal>
	);
}
