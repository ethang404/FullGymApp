import { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/typography";
import { SET_TYPE_OPTIONS } from "../constants";
import type { SetType } from "../types";

//The "W ⌄" pill. Tapping it slides a "Set type" sheet up from the bottom of the screen.
export function SetTypePicker({ label, value, onChange }: { label: string; value: SetType; onChange: (type: SetType) => void }) {
	const { theme } = useTheme();
	const [open, setOpen] = useState(false);

	const pick = (type: SetType) => {
		setOpen(false);
		if (type !== value) onChange(type);
	};

	const styles = useMemo(
		() =>
			StyleSheet.create({
				pill: {
					flexDirection: "row",
					alignItems: "center",
					gap: 2,
					paddingHorizontal: 8,
					paddingVertical: 4,
					borderRadius: 8,
					backgroundColor: theme.cardBgAlt,
					borderWidth: 1,
					borderColor: theme.border,
				},
				pillText: { fontSize: 13, fontWeight: "700", color: theme.primary },
				overlay: { flex: 1, backgroundColor: theme.overlay, justifyContent: "flex-end" },
				sheet: { backgroundColor: theme.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32, gap: 4 },
				sheetTitle: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 28, color: theme.text, marginBottom: 4 },
				option: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
				optionText: { fontSize: 16, color: theme.text },
			}),
		[theme],
	);

	return (
		<>
			<Pressable style={styles.pill} onPress={() => setOpen(true)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Set type: ${value}`}>
				<Text style={styles.pillText}>{label}</Text>
				<Ionicons name="chevron-down" size={11} color={theme.primary} />
			</Pressable>

			<Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
				{/* dark full-screen layer: tapping it (anywhere above the sheet) closes the sheet */}
				<Pressable style={styles.overlay} onPress={() => setOpen(false)}>
					<View style={styles.sheet}>
						<Text style={styles.sheetTitle}>Set type</Text>
						{SET_TYPE_OPTIONS.map((option) => (
							<Pressable key={option.type} style={styles.option} onPress={() => pick(option.type)}>
								<Text style={styles.optionText}>{option.label}</Text>
								{option.type === value && <Ionicons name="checkmark" size={18} color={theme.primary} />}
							</Pressable>
						))}
					</View>
				</Pressable>
			</Modal>
		</>
	);
}
