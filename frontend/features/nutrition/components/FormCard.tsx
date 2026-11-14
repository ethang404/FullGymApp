import { useMemo, type ReactNode } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";

type FormCardProps = {
	title: string;
	action?: { label: string; onPress?: () => void };
	children?: ReactNode;
	showChildren?: boolean;
	onToggle?: () => void;
};

// A titled card on the create food form ("Basics", "Serving sizes"...), with an
// optional small action on the right of its header.
export function FormCard({ title, action, children, showChildren = true, onToggle }: FormCardProps) {
	const { theme } = useTheme();
	const styles = useMemo(
		() =>
			StyleSheet.create({
				card: {
					backgroundColor: theme.cardBg,
					borderRadius: 16,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.border,
					paddingHorizontal: 16,
					paddingTop: 14,
					paddingBottom: 4,
					marginTop: 20,
				},
				headerRow: {
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					paddingBottom: 10,
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: theme.border,
				},
				headerLabel: {
					color: theme.primary,
					fontSize: 11,
					fontWeight: "600",
				},
				action: {
					color: theme.primary,
					fontSize: 11,
					fontWeight: "700",
				},
			}),
		[theme],
	);

	return (
		<View style={styles.card}>
			<TouchableOpacity onPress={onToggle} activeOpacity={0.6}>
				<View style={styles.headerRow}>
					<Text style={styles.headerLabel}>{title}</Text>
					{!showChildren && <FontAwesome5 name="chevron-down" size={11} color={theme.primary} />}
					{action && (
						<TouchableOpacity onPress={action.onPress} hitSlop={8}>
							<Text style={styles.action}>{action.label}</Text>
						</TouchableOpacity>
					)}
				</View>
			</TouchableOpacity>
			{showChildren && children}
		</View>
	);
}
