import { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/ThemeProvider";
import { SERVING_UNIT_OPTIONS } from "../constants";

// Bottom sheet listing serving units, plus a box to type a custom one ("scoop").
export function UnitPickerModal({ visible, onSelect, onClose }: { visible: boolean; onSelect: (unit: string) => void; onClose: () => void }) {
	const { theme } = useTheme();

	// Text typed into the "custom unit" entry at the bottom of the list
	const [customUnitText, setCustomUnitText] = useState("");

	// Start with an empty custom box each time the sheet opens - done during render
	// rather than in an effect so it never paints with the previous text.
	const [wasVisible, setWasVisible] = useState(visible);
	if (visible !== wasVisible) {
		setWasVisible(visible);
		if (visible) setCustomUnitText("");
	}

	const submitCustom = () => {
		const unit = customUnitText.trim();
		if (unit) onSelect(unit);
	};

	const styles = useMemo(
		() =>
			StyleSheet.create({
				backdrop: {
					flex: 1,
					justifyContent: "flex-end",
					backgroundColor: theme.overlay,
				},
				sheet: {
					backgroundColor: theme.cardBg,
					borderTopLeftRadius: 20,
					borderTopRightRadius: 20,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.border,
					paddingHorizontal: 20,
					paddingTop: 16,
					paddingBottom: 32,
					maxHeight: "60%",
				},
				title: {
					color: theme.textMuted,
					fontSize: 11,
					fontWeight: "600",
					paddingBottom: 12,
				},
				option: {
					paddingVertical: 16,
				},
				optionText: {
					color: theme.text,
					fontSize: 16,
					fontWeight: "500",
				},
				divider: {
					height: StyleSheet.hairlineWidth,
					backgroundColor: theme.borderLight,
				},
				customRow: {
					flexDirection: "row",
					alignItems: "center",
					gap: 10,
					paddingTop: 14,
				},
				customInput: {
					flex: 1,
					color: theme.text,
					fontSize: 16,
					paddingVertical: 4,
				},
				customAddButton: {
					padding: 2,
				},
			}),
		[theme],
	);

	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
			<View style={styles.backdrop}>
				<TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
				<View style={styles.sheet}>
					<Text style={styles.title}>Pick a unit</Text>
					<FlatList
						data={SERVING_UNIT_OPTIONS}
						keyExtractor={(item) => item}
						ItemSeparatorComponent={() => <View style={styles.divider} />}
						renderItem={({ item }) => (
							<TouchableOpacity style={styles.option} onPress={() => onSelect(item)}>
								<Text style={styles.optionText}>{item}</Text>
							</TouchableOpacity>
						)}
						ListFooterComponent={
							<>
								<View style={styles.divider} />
								<View style={styles.customRow}>
									<TextInput
										style={styles.customInput}
										placeholder="Custom unit (e.g. scoop)"
										placeholderTextColor={theme.inputPlaceholder}
										value={customUnitText}
										onChangeText={setCustomUnitText}
										onSubmitEditing={submitCustom}
										returnKeyType="done"
									/>
									<TouchableOpacity style={styles.customAddButton} onPress={submitCustom} disabled={!customUnitText.trim()} hitSlop={8}>
										<Ionicons name="checkmark-circle" size={26} color={customUnitText.trim() ? theme.primary : theme.textQuaternary} />
									</TouchableOpacity>
								</View>
							</>
						}
					/>
				</View>
			</View>
		</Modal>
	);
}
