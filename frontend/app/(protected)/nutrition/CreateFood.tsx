import React, { useState, useRef, useMemo } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ServingSize, NUTRIENT_NAME_TO_IDS, FIXED_UNIT_CONVERSIONS } from "../types/nutrition";
import { instance } from "@/utils/AxiosInterceptorHandler";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";

import { useTheme } from "@/theme/ThemeProvider";

import { CameraView, useCameraPermissions } from "expo-camera";
//import { recognizeText, type OcrResult } from "expo-ocr-kit"; //Need to do proper build for this, so delay

interface ServingSizeRow {
	name: string; // unit label as it appears on the package, e.g. "oz", "slice", "Grams (g)"
	qty: string; // how many of that unit make up the gram equivalent, e.g. "4"
	weight_g: string; // gram equivalent for that qty, e.g. "112"
}

// Pre-specified list of selectable units for the serving size
const SERVING_UNIT_OPTIONS: string[] = ["g", "kg", "oz", "lb", "mg", "ml", "l", "cup", "tbsp", "tsp", "slice", "piece", "serving"];

function roundGrams(grams: number): string {
	return (Math.round(grams * 100) / 100).toString();
}

interface MicronutrientField {
	nutrient_name: string; // must match backend value verbatim
	nutrient_id: number;
	label: string;
	unit: string;
	value: string;
}

const DEFAULT_MICRONUTRIENTS: MicronutrientField[] = [
	// ── Carb & Fat Breakdown ───────────────────────────────
	{ nutrient_name: "fiber", nutrient_id: NUTRIENT_NAME_TO_IDS.FIBER, label: "Fiber", unit: "g", value: "0" },
	{ nutrient_name: "sugar", nutrient_id: NUTRIENT_NAME_TO_IDS.SUGAR, label: "Sugar", unit: "g", value: "0" },
	{ nutrient_name: "added_sugar", nutrient_id: NUTRIENT_NAME_TO_IDS.ADDED_SUGAR, label: "Added Sugar", unit: "g", value: "0" },
	{ nutrient_name: "saturated_fat", nutrient_id: NUTRIENT_NAME_TO_IDS.SATURATED_FAT, label: "Saturated Fat", unit: "g", value: "0" },
	{ nutrient_name: "trans_fat", nutrient_id: NUTRIENT_NAME_TO_IDS.TRANS_FAT, label: "Trans Fat", unit: "g", value: "0" },
	{ nutrient_name: "polyunsaturated_fat", nutrient_id: NUTRIENT_NAME_TO_IDS.POLYUNSATURATED_FAT, label: "Polyunsaturated Fat", unit: "g", value: "0" },
	{ nutrient_name: "monounsaturated_fat", nutrient_id: NUTRIENT_NAME_TO_IDS.MONOUNSATURATED_FAT, label: "Monounsaturated Fat", unit: "g", value: "0" },

	// ── Minerals ─────────────────────────────────────────────
	{ nutrient_name: "sodium", nutrient_id: NUTRIENT_NAME_TO_IDS.SODIUM, label: "Sodium", unit: "mg", value: "0" },
	{ nutrient_name: "cholesterol", nutrient_id: NUTRIENT_NAME_TO_IDS.CHOLESTEROL, label: "Cholesterol", unit: "mg", value: "0" },
	{ nutrient_name: "calcium", nutrient_id: NUTRIENT_NAME_TO_IDS.CALCIUM, label: "Calcium", unit: "mg", value: "0" },
	{ nutrient_name: "iron", nutrient_id: NUTRIENT_NAME_TO_IDS.IRON, label: "Iron", unit: "mg", value: "0" },
	{ nutrient_name: "potassium", nutrient_id: NUTRIENT_NAME_TO_IDS.POTASSIUM, label: "Potassium", unit: "mg", value: "0" },
	{ nutrient_name: "magnesium", nutrient_id: NUTRIENT_NAME_TO_IDS.MAGNESIUM, label: "Magnesium", unit: "mg", value: "0" },
	{ nutrient_name: "phosphorus", nutrient_id: NUTRIENT_NAME_TO_IDS.PHOSPHORUS, label: "Phosphorus", unit: "mg", value: "0" },
	{ nutrient_name: "zinc", nutrient_id: NUTRIENT_NAME_TO_IDS.ZINC, label: "Zinc", unit: "mg", value: "0" },

	// ── Vitamins ─────────────────────────────────────────────
	{ nutrient_name: "vitamin_a", nutrient_id: NUTRIENT_NAME_TO_IDS.VITAMIN_A, label: "Vitamin A", unit: "µg", value: "0" },
	{ nutrient_name: "vitamin_c", nutrient_id: NUTRIENT_NAME_TO_IDS.VITAMIN_C, label: "Vitamin C", unit: "mg", value: "0" },
	{ nutrient_name: "vitamin_d", nutrient_id: NUTRIENT_NAME_TO_IDS.VITAMIN_D, label: "Vitamin D", unit: "µg", value: "0" },
	{ nutrient_name: "vitamin_e", nutrient_id: NUTRIENT_NAME_TO_IDS.VITAMIN_E, label: "Vitamin E", unit: "mg", value: "0" },
	{ nutrient_name: "vitamin_k", nutrient_id: NUTRIENT_NAME_TO_IDS.VITAMIN_K, label: "Vitamin K", unit: "µg", value: "0" },
	{ nutrient_name: "vitamin_b6", nutrient_id: NUTRIENT_NAME_TO_IDS.VITAMIN_B6, label: "Vitamin B6", unit: "mg", value: "0" },
	{ nutrient_name: "vitamin_b12", nutrient_id: NUTRIENT_NAME_TO_IDS.VITAMIN_B12, label: "Vitamin B12", unit: "µg", value: "0" },
	{ nutrient_name: "folate", nutrient_id: NUTRIENT_NAME_TO_IDS.FOLATE, label: "Folate", unit: "µg", value: "0" },
	{ nutrient_name: "thiamin", nutrient_id: NUTRIENT_NAME_TO_IDS.THIAMIN, label: "Thiamin (B1)", unit: "mg", value: "0" },
	{ nutrient_name: "riboflavin", nutrient_id: NUTRIENT_NAME_TO_IDS.RIBOFLAVIN, label: "Riboflavin (B2)", unit: "mg", value: "0" },
	{ nutrient_name: "niacin", nutrient_id: NUTRIENT_NAME_TO_IDS.NIACIN, label: "Niacin (B3)", unit: "mg", value: "0" },
];

export default function CreateFood() {
	const router = useRouter();
	const { theme } = useTheme();

	const [foodName, setFoodName] = useState("");
	const [brand, setBrand] = useState("");
	const [barcode, setBarcode] = useState("");

	const [servingSizes, setServingSizes] = useState<ServingSizeRow[]>([{ name: "", qty: "", weight_g: "" }]);

	const [calories, setCalories] = useState("");
	const [protein, setProtein] = useState("");
	const [carbs, setCarbs] = useState("");
	const [fats, setFats] = useState("");

	const [micronutrients, setMicronutrients] = useState<MicronutrientField[]>(DEFAULT_MICRONUTRIENTS);

	const [isCreating, setIsCreating] = useState(false);

	// Index of the serving size row whose unit picker is currently open (null = closed)
	const [openUnitPickerIndex, setOpenUnitPickerIndex] = useState<number | null>(null);

	//Camera & Barcode state specific items:
	const [isCameraOpen, setIsCameraOpen] = useState(false);
	const [permission, requestPermission] = useCameraPermissions();

	//Camera specifically for taking pictures of nutrition labels
	const [isOcrCameraOpen, setIsOcrCameraOpen] = useState(false);
	const [isOcrCameraReady, setIsOcrCameraReady] = useState(false);
	const ocrCameraRef = useRef<CameraView>(null);

	const styles = useMemo(
		() =>
			StyleSheet.create({
				safeArea: {
					flex: 1,
					backgroundColor: "#000",
				},
				header: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					paddingHorizontal: 20,
					paddingVertical: 16,
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: "#2a2a2a",
				},
				headerArea: {
					flexDirection: "row",
					justifyContent: "space-between",
				},
				scroll: {
					flex: 1,
				},
				scrollContent: {
					paddingHorizontal: 20,
					paddingBottom: 40,
				},
				eyebrow: {
					color: "#777",
					fontSize: 11,
					letterSpacing: 1,
					marginTop: 24,
					fontWeight: "600",
				},
				pageTitle: {
					color: "#fff",
					fontSize: 34,
					fontWeight: "800",
					letterSpacing: 1,
					marginTop: 4,
					marginBottom: 8,
				},

				card: {
					backgroundColor: CARD_BG,
					borderRadius: 16,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: CARD_BORDER,
					paddingHorizontal: 16,
					paddingTop: 14,
					paddingBottom: 4,
					marginTop: 20,
				},
				cardHeaderRow: {
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					paddingBottom: 10,
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: CARD_BORDER,
				},
				cardHeaderLabel: {
					color: theme.primary,
					fontSize: 11,
					letterSpacing: 0.5,
					fontWeight: "600",
				},
				addSize: {
					color: "#fff",
					fontSize: 11,
					letterSpacing: 0.5,
					fontWeight: "700",
				},
				noBorder: {
					borderBottomWidth: 0,
				},

				field: {
					marginTop: 16,
					paddingBottom: 12,
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: DIVIDER,
				},
				fieldLast: {
					borderBottomWidth: 0,
				},
				fieldLabel: {
					color: "#777",
					fontSize: 11,
					letterSpacing: 0.5,
					fontWeight: "600",
					marginBottom: 8,
				},
				fieldInputRow: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
				},
				fieldInput: {
					color: "#fff",
					fontSize: 16,
					padding: 0,
					flex: 1,
				},
				scanButton: {
					paddingLeft: 12,
				},

				servingHeaderRow: {
					flexDirection: "row",
					marginTop: 14,
				},
				servingHeaderText: {
					color: "#777",
					fontSize: 10,
					letterSpacing: 0.5,
					fontWeight: "600",
				},
				servingRow: {
					flexDirection: "row",
					alignItems: "center",
					marginTop: 10,
					paddingBottom: 10,
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: DIVIDER,
				},
				servingInput: {
					color: "#fff",
					fontSize: 16,
					padding: 0,
				},
				unitSuffix: {
					color: "#777",
					fontSize: 12,
					marginLeft: 4,
				},
				unitSelect: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					paddingRight: 8,
				},
				unitSelectText: {
					color: "#fff",
					fontSize: 16,
				},
				unitSelectPlaceholder: {
					color: "#555",
					fontSize: 16,
				},

				modalBackdrop: {
					flex: 1,
					justifyContent: "flex-end",
					backgroundColor: "rgba(0,0,0,0.6)",
				},
				modalSheet: {
					backgroundColor: "#0e0e0e",
					borderTopLeftRadius: 20,
					borderTopRightRadius: 20,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: CARD_BORDER,
					paddingHorizontal: 20,
					paddingTop: 16,
					paddingBottom: 32,
					maxHeight: "60%",
				},
				modalTitle: {
					color: "#777",
					fontSize: 11,
					letterSpacing: 0.5,
					fontWeight: "600",
					paddingBottom: 12,
				},
				modalOption: {
					paddingVertical: 16,
				},
				modalOptionText: {
					color: "#fff",
					fontSize: 16,
					fontWeight: "500",
				},
				modalDivider: {
					height: StyleSheet.hairlineWidth,
					backgroundColor: DIVIDER,
				},

				macroRow: {
					flexDirection: "row",
					alignItems: "center",
					paddingVertical: 16,
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: DIVIDER,
				},
				macroBar: {
					width: 3,
					height: 20,
					borderRadius: 2,
					marginRight: 14,
				},
				macroBarSpacer: {
					width: 3,
					marginRight: 14,
				},
				macroLabel: {
					color: "#fff",
					fontSize: 15,
					fontWeight: "600",
					flex: 1,
				},
				macroValueWrap: {
					flexDirection: "row",
					alignItems: "baseline",
				},
				macroInput: {
					color: "#fff",
					fontSize: 20,
					fontWeight: "700",
					minWidth: 50,
					padding: 0,
				},
				macroUnit: {
					color: "#777",
					fontSize: 13,
					marginLeft: 6,
				},

				microRow: {
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					paddingVertical: 14,
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: DIVIDER,
				},
				microLabel: {
					color: "#999",
					fontSize: 12,
					letterSpacing: 0.3,
					fontWeight: "600",
				},
				microValueWrap: {
					flexDirection: "row",
					alignItems: "baseline",
				},
				microInput: {
					color: "#fff",
					fontSize: 15,
					fontWeight: "600",
					minWidth: 36,
					padding: 0,
				},
				microUnit: {
					color: "#777",
					fontSize: 12,
					marginLeft: 4,
				},

				createButton: {
					backgroundColor: "#e0524f",
					borderRadius: 30,
					paddingVertical: 18,
					alignItems: "center",
					justifyContent: "center",
					marginTop: 28,
				},
				createButtonText: {
					color: "#fff",
					fontSize: 14,
					fontWeight: "700",
					letterSpacing: 1,
				},

				// Camera scanner styles
				cameraContainer: {
					flex: 1,
					backgroundColor: "#000",
				},
				cameraOverlay: {
					flex: 1,
					justifyContent: "space-between",
					alignItems: "center",
					paddingVertical: 20,
				},
				closeCameraButton: {
					alignSelf: "flex-end",
					paddingRight: 20,
					paddingTop: 10,
				},
				scannerTargetBox: {
					width: 260,
					height: 180,
					borderWidth: 2,
					borderColor: "#e0524f",
					borderRadius: 12,
					backgroundColor: "transparent",
				},
				scannerGuideText: {
					color: "#fff",
					fontSize: 14,
					fontWeight: "600",
					marginBottom: 30,
					backgroundColor: "rgba(0,0,0,0.6)",
					paddingHorizontal: 16,
					paddingVertical: 8,
					borderRadius: 20,
					overflow: "hidden",
				},
			}),
		[theme],
	);

	function Field({
		label,
		placeholder,
		value,
		onChangeText,
		isLast,
		rightElement,
	}: {
		label: string;
		placeholder: string;
		value: string;
		onChangeText: (v: string) => void;
		isLast?: boolean;
		rightElement?: React.ReactNode;
	}) {
		return (
			<View style={[styles.field, isLast && styles.fieldLast]}>
				<Text style={styles.fieldLabel}>{label}</Text>
				<View style={styles.fieldInputRow}>
					<TextInput style={styles.fieldInput} placeholder={placeholder} placeholderTextColor="#555" value={value} onChangeText={onChangeText} />
					{rightElement}
				</View>
			</View>
		);
	}

	function MacroRow({
		label,
		value,
		onChangeText,
		unit,
		barColor,
		isLast,
	}: {
		label: string;
		value: string;
		onChangeText: (v: string) => void;
		unit: string;
		barColor?: string;
		isLast?: boolean;
	}) {
		return (
			<View style={[styles.macroRow, isLast && styles.noBorder]}>
				{barColor ? <View style={[styles.macroBar, { backgroundColor: barColor }]} /> : <View style={styles.macroBarSpacer} />}
				<Text style={styles.macroLabel}>{label}</Text>
				<View style={styles.macroValueWrap}>
					<TextInput
						style={styles.macroInput}
						value={value}
						onChangeText={onChangeText}
						keyboardType="decimal-pad"
						placeholder="0"
						placeholderTextColor="#555"
						textAlign="right"
					/>
					<Text style={styles.macroUnit}>{unit}</Text>
				</View>
			</View>
		);
	}

	const handleOpenScanner = async () => {
		if (!permission?.granted) {
			const res = await requestPermission();
			if (!res.granted) {
				Alert.alert("Permission Required", "Camera access is required to scan barcodes.");
				return;
			}
		}
		setIsCameraOpen(true);
	};

	const handleOpenCamera = async () => {
		if (!permission?.granted) {
			const res = await requestPermission();
			if (!res.granted) {
				Alert.alert("Permission Required", "Camera access is required to scan the label.");
				return;
			}
		}
		setIsOcrCameraOpen(true);
	};

	const handleCaptureLabel = async () => {
		if (!ocrCameraRef.current || !isOcrCameraReady) return;

		const photo = await ocrCameraRef.current.takePictureAsync({ quality: 1 });
		setIsOcrCameraOpen(false);
		setIsOcrCameraReady(false);

		// pass photo.uri into OCR here
		//const result: OcrResult = await recognizeText(photo.uri);
	};

	const handleBarcodeScanned = ({ data }: { data: string }) => {
		setBarcode(data); //automatically populate barcode for us!
		setIsCameraOpen(false);
	};
	//----

	const addServingSize = () => {
		setServingSizes((prev) => [...prev, { name: "", qty: "", weight_g: "" }]);
	};

	const updateServingSize = (index: number, field: keyof ServingSizeRow, value: string) => {
		setServingSizes((prev) =>
			prev.map((row, i) => {
				if (i !== index) return row;

				const updated = { ...row, [field]: value };

				if (field === "qty") {
					const factor = FIXED_UNIT_CONVERSIONS[row.name];
					if (factor != null) {
						const qty = Number(value) || 0;
						updated.weight_g = qty > 0 ? roundGrams(qty * factor) : "";
					}
				}

				return updated;
			}),
		);
	};

	const selectServingUnit = (unit: string) => {
		if (openUnitPickerIndex === null) return;
		const index = openUnitPickerIndex;

		setServingSizes((prev) =>
			prev.map((row, i) => {
				if (i !== index) return row;

				const factor = FIXED_UNIT_CONVERSIONS[unit];
				if (factor == null) {
					return { ...row, name: unit };
				}

				const qty = Number(row.qty) || 1;
				return {
					...row,
					name: unit,
					qty: row.qty || "1",
					weight_g: roundGrams(qty * factor),
				};
			}),
		);

		setOpenUnitPickerIndex(null);
	};

	const updateMicronutrient = (nutrientId: number, value: string) => {
		setMicronutrients((prev) => prev.map((m) => (m.nutrient_id === nutrientId ? { ...m, value } : m)));
	};

	const handleCreateItem = async () => {
		if (!foodName.trim()) {
			Alert.alert("Food name required", "Please enter a name for this food.");
			return;
		}

		const servingSizesPayload: ServingSize[] = servingSizes
			.map((row) => {
				const name = row.name.trim();
				const qty = row.qty.trim();
				const label = qty && name ? `${qty} ${name}` : name || qty;

				return {
					label,
					weight_g: Number(row.weight_g) || 0,
				};
			})
			.filter((s) => s.label && s.weight_g > 0);

		if (servingSizesPayload.length === 0) {
			Alert.alert("Serving size required", "Enter a valid name, quantity, and gram equivalent for at least one serving size.");
			return;
		}

		const nutrients = [
			{ nutrient_name: "calories", unit: "kcal", nutrient_amount: Number(calories) || 0 },
			{ nutrient_name: "protein", unit: "g", nutrient_amount: Number(protein) || 0 },
			{ nutrient_name: "carbs", unit: "g", nutrient_amount: Number(carbs) || 0 },
			{ nutrient_name: "fat", unit: "g", nutrient_amount: Number(fats) || 0 },
			...micronutrients.map((m) => ({
				nutrient_name: m.nutrient_name,
				unit: m.unit,
				nutrient_amount: Number(m.value) || 0,
			})),
		];

		const payload = {
			name: foodName.trim(),
			brand: brand.trim() || null,
			barcode: barcode.trim() || null,
			serving_sizes: servingSizesPayload,
			nutrients,
		};

		try {
			setIsCreating(true);
			await instance.post(`/nutrition/foods`, payload);

			router.back();
		} catch (err) {
			Alert.alert("Something went wrong", "Could not create this food item.");
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<SafeAreaView style={styles.safeArea}>
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()} hitSlop={12}>
					<Ionicons name="close" size={26} color="#fff" />
				</TouchableOpacity>
			</View>

			<ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
				<Text style={styles.eyebrow}>ENTRY CREATION</Text>
				<View style={styles.headerArea}>
					<Text style={styles.pageTitle}>NEW FOOD</Text>
					<TouchableOpacity style={styles.scanButton} onPress={handleOpenCamera} hitSlop={8}>
						<FontAwesome5 name="nutritionix" size={24} color="#e0524f" />
					</TouchableOpacity>
				</View>

				<View style={styles.card}>
					<View style={styles.cardHeaderRow}>
						<Text style={styles.cardHeaderLabel}>GENERAL INFO</Text>
					</View>

					<Field label="FOOD NAME" placeholder="e.g. Grass-fed Ribeye" value={foodName} onChangeText={setFoodName} />
					<Field label="BRAND / CATEGORY" placeholder="e.g. Local Farmhouse" value={brand} onChangeText={setBrand} />

					{/* Barcode input with custom scan button embedded */}
					<Field
						label="BARCODE"
						placeholder="Scan or enter code"
						value={barcode}
						onChangeText={setBarcode}
						isLast
						rightElement={
							<TouchableOpacity style={styles.scanButton} onPress={handleOpenScanner} hitSlop={8}>
								<Ionicons name="barcode-outline" size={22} color="#e0524f" />
							</TouchableOpacity>
						}
					/>
				</View>

				<View style={styles.card}>
					<View style={styles.cardHeaderRow}>
						<Text style={styles.cardHeaderLabel}>SERVING SIZES</Text>
						<TouchableOpacity onPress={addServingSize} hitSlop={8}>
							<Text style={styles.addSize}>+ ADD SIZE</Text>
						</TouchableOpacity>
					</View>

					<View style={styles.servingHeaderRow}>
						<Text style={[styles.servingHeaderText, { flex: 1.6 }]}>Name</Text>
						<Text style={[styles.servingHeaderText, { flex: 1, textAlign: "right" }]}>Qty</Text>
						<Text style={[styles.servingHeaderText, { flex: 1.5, textAlign: "right" }]}>Gram Equiv.</Text>
					</View>

					{servingSizes.map((row, index) => (
						<View key={index} style={[styles.servingRow, index === servingSizes.length - 1 && styles.noBorder]}>
							<TouchableOpacity style={[styles.unitSelect, { flex: 1.6 }]} onPress={() => setOpenUnitPickerIndex(index)} activeOpacity={0.7}>
								<Text style={row.name ? styles.unitSelectText : styles.unitSelectPlaceholder} numberOfLines={1}>
									{row.name || "Select"}
								</Text>
								<Ionicons name="chevron-down" size={14} color="#777" />
							</TouchableOpacity>
							<TextInput
								style={[styles.servingInput, { flex: 1, textAlign: "right" }]}
								value={row.qty}
								onChangeText={(v) => updateServingSize(index, "qty", v)}
								keyboardType="decimal-pad"
								placeholder="Qty"
								placeholderTextColor="#555"
							/>
							<View style={{ flex: 1.5, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" }}>
								<TextInput
									style={[styles.servingInput, { textAlign: "right" }]}
									value={row.weight_g}
									onChangeText={(v) => updateServingSize(index, "weight_g", v)}
									keyboardType="decimal-pad"
									placeholder="0"
									placeholderTextColor="#555"
								/>
								<Text style={styles.unitSuffix}>G</Text>
							</View>
						</View>
					))}
				</View>

				<View style={styles.card}>
					<View style={styles.cardHeaderRow}>
						<Text style={styles.cardHeaderLabel}>NUTRITIONAL CALIBRATION</Text>
					</View>

					<MacroRow label="CALORIES" value={calories} onChangeText={setCalories} unit="kcal" />
					<MacroRow label="PROTEIN" value={protein} onChangeText={setProtein} unit="g" barColor="#3ddc84" />
					<MacroRow label="CARBOHYDRATES" value={carbs} onChangeText={setCarbs} unit="g" barColor="#888" />
					<MacroRow label="FATS" value={fats} onChangeText={setFats} unit="g" barColor="#e0524f" isLast />
				</View>

				<View style={styles.card}>
					<View style={styles.cardHeaderRow}>
						<Text style={styles.cardHeaderLabel}>MICRONUTRIENTS & VITAMINS</Text>
						<TouchableOpacity hitSlop={8}>
							<Text style={styles.addSize}>EDIT LIST</Text>
						</TouchableOpacity>
					</View>

					{micronutrients.map((m, i) => (
						<View key={m.nutrient_id} style={[styles.microRow, i === micronutrients.length - 1 && styles.noBorder]}>
							<Text style={styles.microLabel}>{m.label.toUpperCase()}</Text>
							<View style={styles.microValueWrap}>
								<TextInput
									style={styles.microInput}
									value={m.value}
									onChangeText={(v) => updateMicronutrient(m.nutrient_id, v)}
									keyboardType="decimal-pad"
									textAlign="right"
								/>
								<Text style={styles.microUnit}>{m.unit}</Text>
							</View>
						</View>
					))}
				</View>

				<TouchableOpacity style={styles.createButton} onPress={handleCreateItem} disabled={isCreating} activeOpacity={0.85}>
					{isCreating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createButtonText}>CREATE ITEM</Text>}
				</TouchableOpacity>
			</ScrollView>

			{/* Unit Selection Modal */}
			<Modal visible={openUnitPickerIndex !== null} transparent animationType="fade" onRequestClose={() => setOpenUnitPickerIndex(null)}>
				<View style={styles.modalBackdrop}>
					<TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setOpenUnitPickerIndex(null)} />
					<View style={styles.modalSheet}>
						<Text style={styles.modalTitle}>SELECT UNIT</Text>
						<FlatList
							data={SERVING_UNIT_OPTIONS}
							keyExtractor={(item) => item}
							ItemSeparatorComponent={() => <View style={styles.modalDivider} />}
							renderItem={({ item }) => (
								<TouchableOpacity style={styles.modalOption} onPress={() => selectServingUnit(item)}>
									<Text style={styles.modalOptionText}>{item}</Text>
								</TouchableOpacity>
							)}
						/>
					</View>
				</View>
			</Modal>

			{/* Barcode Scanner Camera Modal here*/}
			<Modal visible={isCameraOpen} animationType="slide" onRequestClose={() => setIsCameraOpen(false)}>
				<View style={styles.cameraContainer}>
					<CameraView
						style={StyleSheet.absoluteFill}
						facing="back"
						onBarcodeScanned={handleBarcodeScanned}
						barcodeScannerSettings={{
							barcodeTypes: ["upc_a", "upc_e", "ean13", "ean8", "code128", "qr"],
						}}
					/>
					<SafeAreaView style={styles.cameraOverlay}>
						<TouchableOpacity style={styles.closeCameraButton} onPress={() => setIsCameraOpen(false)}>
							<Ionicons name="close-circle" size={40} color="#fff" />
						</TouchableOpacity>
						<View style={styles.scannerTargetBox} />
						<Text style={styles.scannerGuideText}>Align barcode within the box</Text>
					</SafeAreaView>
				</View>
			</Modal>

			{/* OCR Nutrition Label Camera Modal */}
			<Modal visible={isOcrCameraOpen} animationType="slide" onRequestClose={() => setIsOcrCameraOpen(false)}>
				<View style={styles.cameraContainer}>
					<CameraView ref={ocrCameraRef} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setIsOcrCameraReady(true)} />
					<SafeAreaView style={styles.cameraOverlay}>
						<TouchableOpacity style={styles.closeCameraButton} onPress={() => setIsOcrCameraOpen(false)}>
							<Ionicons name="close-circle" size={40} color="#fff" />
						</TouchableOpacity>
						<View style={styles.scannerTargetBox} />
						<TouchableOpacity
							style={[styles.createButton, { opacity: isOcrCameraReady ? 1 : 0.5, marginBottom: 20 }]}
							onPress={handleCaptureLabel}
							disabled={!isOcrCameraReady}
						>
							<Text style={styles.createButtonText}>{isOcrCameraReady ? "CAPTURE LABEL" : "LOADING..."}</Text>
						</TouchableOpacity>
					</SafeAreaView>
				</View>
			</Modal>
		</SafeAreaView>
	);
}

const CARD_BG = "#0e0e0e";
const CARD_BORDER = "#232323";
const DIVIDER = "#1e1e1e";
