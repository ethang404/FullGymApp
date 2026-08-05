import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useMemo, useState, useEffect } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import type { Theme } from "@/theme/colors"; //for typing

import { instance } from "@/utils/AxiosInterceptorHandler";

import type { ServingSize } from "../../types/nutrition";

import { FIXED_UNIT_CONVERSIONS } from "../../types/nutrition";

interface AddServingModalProps {
	visible: boolean;
	foodId: number;
	foodName: string;
	availableUnits: string[];
	theme: Theme;
	onClose: () => void;
	onServingAdded: (serving: ServingSize) => void;
}

export function AddServingModal({ visible, foodId, foodName, availableUnits, theme, onClose, onServingAdded }: AddServingModalProps) {
	const [newLabel, setNewLabel] = useState("");
	const [newWeight, setNewWeight] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Reset the modal form each time opened
	useEffect(() => {
		if (visible) {
			setNewLabel("");
			setNewWeight("");
			setError(null);
		}
	}, [visible]);

	async function handleSave() {
		const weight = parseFloat(newWeight);
		if (!newLabel) {
			setError("Choose a unit first.");
			return;
		}
		if (!weight || weight <= 0) {
			setError("Enter a valid weight in grams.");
			return;
		}

		setSaving(true);
		setError(null);
		try {
			const res = await instance.post(`/nutrition/foods/${foodId}/serving-sizes`, {
				label: newLabel,
				weight_g: weight,
			});

			const created: ServingSize = {
				label: res.data.foodServing.label,
				weight_g: parseFloat(res.data.foodServing.weight_g), //convert from string to number...change on backend later
			};

			onServingAdded(created);
		} catch (e) {
			console.error("Failed to add serving size:", e);
			setError("Something went wrong saving that. Please try again.");
		} finally {
			setSaving(false);
		}
	}

	function selectUnit(unit: string) {
		setNewLabel(unit);
		setError(null);

		const fixedWeight = FIXED_UNIT_CONVERSIONS[unit];
		if (fixedWeight != null) {
			setNewWeight(String(fixedWeight)); // pre-computed: pull from dict.
		} else {
			setNewWeight(""); // user entered number
		}
	}

	const styles = useMemo(
		() =>
			StyleSheet.create({
				overlay: {
					flex: 1,
					justifyContent: "flex-end",
					backgroundColor: "rgba(0,0,0,0.5)",
				},
				sheet: {
					backgroundColor: theme.cardBg,
					borderTopLeftRadius: 20,
					borderTopRightRadius: 20,
					padding: 20,
					paddingBottom: 32,
				},
				headerRow: {
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: 4,
				},
				title: {
					color: theme.text,
					fontSize: 17,
					fontWeight: "700",
					flex: 1,
				},
				subtitle: {
					color: theme.textMuted,
					fontSize: 13,
					marginBottom: 20,
				},
				sectionLabel: {
					color: theme.textMuted,
					fontSize: 11,
					fontWeight: "700",
					letterSpacing: 0.5,
					marginBottom: 8,
				},
				unitRow: {
					flexDirection: "row",
					flexWrap: "wrap",
					gap: 8,
					marginBottom: 20,
				},
				unitPill: {
					paddingVertical: 8,
					paddingHorizontal: 14,
					borderRadius: 20,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.border,
				},
				unitPillSelected: {
					backgroundColor: theme.primary,
					borderColor: theme.primary,
				},
				unitPillText: {
					fontSize: 13,
					fontWeight: "600",
					color: theme.text,
				},
				unitPillTextSelected: {
					color: theme.cardBg,
				},
				weightInput: {
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.inputBorder,
					backgroundColor: theme.inputBg,
					borderRadius: 12,
					paddingHorizontal: 14,
					paddingVertical: 12,
					color: theme.text,
					fontSize: 16,
					marginBottom: 8,
				},
				hint: {
					color: theme.textMuted,
					fontSize: 12,
					marginBottom: 20,
				},
				errorText: {
					color: "#F87171",
					fontSize: 12,
					marginBottom: 12,
				},
				saveButton: {
					backgroundColor: theme.primary,
					borderRadius: 14,
					paddingVertical: 14,
					alignItems: "center",
					marginBottom: 10,
					opacity: saving ? 0.6 : 1,
				},
				saveButtonText: {
					color: theme.cardBg,
					fontSize: 15,
					fontWeight: "700",
				},
				cancelButton: {
					alignItems: "center",
					paddingVertical: 10,
				},
				cancelButtonText: {
					color: theme.textMuted,
					fontSize: 14,
					fontWeight: "600",
				},
			}),
		[theme, saving],
	);

	return (
		<Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
			<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
				<View style={styles.sheet}>
					<View style={styles.headerRow}>
						<Text style={styles.title}>Add a serving size</Text>
						<TouchableOpacity onPress={onClose} hitSlop={10}>
							<FontAwesome5 name="times" size={20} color={theme.primary} />
						</TouchableOpacity>
					</View>
					<Text style={styles.subtitle}>for {foodName}</Text>

					<Text style={styles.sectionLabel}>UNIT</Text>
					<View style={styles.unitRow}>
						{availableUnits.map((unit) => {
							const isSelected = unit === newLabel;
							return (
								<TouchableOpacity key={unit} style={[styles.unitPill, isSelected && styles.unitPillSelected]} onPress={() => selectUnit(unit)}>
									<Text style={[styles.unitPillText, isSelected && styles.unitPillTextSelected]}>{unit}</Text>
								</TouchableOpacity>
							);
						})}
					</View>

					{newLabel ? (
						FIXED_UNIT_CONVERSIONS[newLabel] != null ? (
							<Text style={styles.hint}>
								1 {newLabel} = {FIXED_UNIT_CONVERSIONS[newLabel]}g — ready to save.
							</Text>
						) : (
							<>
								<Text style={styles.sectionLabel}>WEIGHT</Text>
								<TextInput
									style={styles.weightInput}
									placeholder="0"
									placeholderTextColor={theme.inputPlaceholder}
									keyboardType="decimal-pad"
									value={newWeight}
									onChangeText={setNewWeight}
								/>
								<Text style={styles.hint}>How many grams is in 1 {newLabel}?</Text>
							</>
						)
					) : (
						<Text style={styles.hint}>Pick a unit above to continue.</Text>
					)}

					{error && <Text style={styles.errorText}>{error}</Text>}

					<TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
						<Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
					</TouchableOpacity>

					<TouchableOpacity style={styles.cancelButton} onPress={onClose}>
						<Text style={styles.cancelButtonText}>Cancel</Text>
					</TouchableOpacity>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}
