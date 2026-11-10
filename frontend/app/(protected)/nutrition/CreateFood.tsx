import { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useCameraPermissions } from "expo-camera";

import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/typography";
import Screen from "@/components/Screen";

import { useCreateFoodForm } from "@/features/nutrition/hooks/useCreateFoodForm";
import { FormCard } from "@/features/nutrition/components/FormCard";
import { FormField } from "@/features/nutrition/components/FormField";
import { MacroInputRow } from "@/features/nutrition/components/MacroInputRow";
import { ServingSizesEditor } from "@/features/nutrition/components/ServingSizesEditor";
import { MicronutrientFields } from "@/features/nutrition/components/MicronutrientFields";
import { UnitPickerModal } from "@/features/nutrition/components/UnitPickerModal";
import { BarcodeScannerModal } from "@/features/nutrition/components/BarcodeScannerModal";
import { NutritionLabelScanner } from "@/features/nutrition/components/NutritionLabelScanner";

export default function CreateFood() {
	const router = useRouter();
	const { theme } = useTheme();
	const form = useCreateFoodForm();

	// UI-only state: which sheet or camera is open
	const [openUnitPickerIndex, setOpenUnitPickerIndex] = useState<number | null>(null); // serving row whose unit picker is open (null = closed)
	const [isBarcodeCameraOpen, setIsBarcodeCameraOpen] = useState(false);
	const [isLabelCameraOpen, setIsLabelCameraOpen] = useState(false);
	const [permission, requestPermission] = useCameraPermissions();

	const [vitaminsOpen, setVitaminsOpen] = useState(false);

	// Ask for the camera before opening either scanner
	const ensureCameraPermission = async (reason: string) => {
		if (permission?.granted) return true;
		const res = await requestPermission();
		if (!res.granted) Alert.alert("Camera access needed", `Allow camera access in Settings to ${reason}.`);
		return res.granted;
	};

	const handleOpenBarcodeScanner = async () => {
		if (await ensureCameraPermission("scan barcodes")) setIsBarcodeCameraOpen(true);
	};

	const handleOpenLabelScanner = async () => {
		if (await ensureCameraPermission("scan nutrition labels")) setIsLabelCameraOpen(true);
	};

	const styles = useMemo(
		() =>
			StyleSheet.create({
				header: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					paddingHorizontal: 20,
					paddingVertical: 16,
					borderBottomWidth: StyleSheet.hairlineWidth,
					borderBottomColor: theme.border,
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
					color: theme.textMuted,
					fontSize: 14,
					marginTop: 24,
					fontWeight: "600",
				},
				pageTitle: {
					color: theme.text,
					fontSize: 34,
					lineHeight: 40,
					fontFamily: fonts.headingHeavy,
					marginTop: 4,
					marginBottom: 8,
				},
				scanButton: {
					paddingLeft: 12,
				},
				createButton: {
					backgroundColor: theme.primary,
					borderRadius: 30,
					paddingVertical: 18,
					alignItems: "center",
					justifyContent: "center",
					marginTop: 28,
				},
				createButtonText: {
					color: theme.textInverse,
					fontSize: 14,
					fontWeight: "700",
				},
			}),
		[theme],
	);

	return (
		<Screen edges={["top", "bottom"]}>
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()} hitSlop={12}>
					<Ionicons name="close" size={26} color={theme.text} />
				</TouchableOpacity>
			</View>

			<ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
				<Text style={styles.eyebrow}>Add your own food</Text>
				<View style={styles.headerArea}>
					{form.foodName ? <Text style={styles.pageTitle}>{form.foodName}</Text> : <Text style={styles.pageTitle}>New Food</Text>}
					<TouchableOpacity style={styles.scanButton} onPress={handleOpenLabelScanner} hitSlop={8}>
						<FontAwesome5 name="nutritionix" size={24} color={theme.primary} />
					</TouchableOpacity>
				</View>

				<FormCard title="Basics">
					<FormField label="Food name" placeholder="e.g. Grass-fed ribeye" value={form.foodName} onChangeText={form.handleFoodNameChange} />
					<FormField label="Brand or category" placeholder="e.g. Local farmhouse" value={form.brand} onChangeText={form.handleBrandChange} />

					{/* Barcode input with custom scan button embedded */}
					<FormField
						label="Barcode"
						placeholder="Scan or enter code"
						value={form.barcode}
						onChangeText={form.setBarcode}
						isLast
						rightElement={
							<TouchableOpacity style={styles.scanButton} onPress={handleOpenBarcodeScanner} hitSlop={8}>
								<Ionicons name="barcode-outline" size={22} color={theme.primary} />
							</TouchableOpacity>
						}
					/>
				</FormCard>

				<FormCard title="Serving sizes" action={{ label: "+ ADD SIZE", onPress: form.addServingSize }}>
					<ServingSizesEditor rows={form.servingSizes} onPressUnit={setOpenUnitPickerIndex} onChangeRow={form.updateServingSize} />
				</FormCard>

				<FormCard title="Nutrition per serving">
					<MacroInputRow label="Calories" value={form.calories} onChangeText={form.setCalories} unit="kcal" />
					<MacroInputRow label="Protein" value={form.protein} onChangeText={form.setProtein} unit="g" barColor={theme.macroProtein} />
					<MacroInputRow label="Carbs" value={form.carbs} onChangeText={form.setCarbs} unit="g" barColor={theme.macroCarbs} />
					<MacroInputRow label="Fat" value={form.fats} onChangeText={form.setFats} unit="g" barColor={theme.macroFat} isLast />
				</FormCard>

				<FormCard title="Vitamins & minerals" showChildren={vitaminsOpen} onToggle={() => setVitaminsOpen((open) => !open)}>
					<MicronutrientFields fields={form.micronutrients} onChange={form.updateMicronutrient} />
				</FormCard>

				<TouchableOpacity style={styles.createButton} onPress={form.handleCreateItem} disabled={form.isCreating} activeOpacity={0.85}>
					{form.isCreating ? <ActivityIndicator color={theme.textInverse} /> : <Text style={styles.createButtonText}>Save food</Text>}
				</TouchableOpacity>
			</ScrollView>

			<UnitPickerModal
				visible={openUnitPickerIndex !== null}
				onSelect={(unit) => {
					if (openUnitPickerIndex !== null) form.selectServingUnit(openUnitPickerIndex, unit);
					setOpenUnitPickerIndex(null);
				}}
				onClose={() => setOpenUnitPickerIndex(null)}
			/>

			<BarcodeScannerModal
				visible={isBarcodeCameraOpen}
				onScanned={(code) => {
					form.setBarcode(code); //automatically populate barcode for us!
					setIsBarcodeCameraOpen(false);
				}}
				onClose={() => setIsBarcodeCameraOpen(false)}
			/>

			<NutritionLabelScanner
				visible={isLabelCameraOpen}
				onScanned={(parsed) => {
					form.applyScannedLabel(parsed);
					Alert.alert("Label scanned", "Check the numbers below. Scans can misread curved or blurry labels.");
				}}
				onClose={() => setIsLabelCameraOpen(false)}
			/>
		</Screen>
	);
}
