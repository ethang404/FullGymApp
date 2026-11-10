import { useMemo } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CameraView } from "expo-camera";
import { useTheme } from "@/theme/ThemeProvider";

// Full-screen camera that reports the first barcode it reads. The caller asks for
// camera permission before opening it.
export function BarcodeScannerModal({ visible, onScanned, onClose }: { visible: boolean; onScanned: (code: string) => void; onClose: () => void }) {
	const { theme } = useTheme();
	const styles = useMemo(
		() =>
			StyleSheet.create({
				container: {
					flex: 1,
					backgroundColor: theme.background,
				},
				overlay: {
					flex: 1,
					justifyContent: "space-between",
					alignItems: "center",
					paddingVertical: 20,
				},
				closeButton: {
					alignSelf: "flex-end",
					paddingRight: 20,
					paddingTop: 10,
				},
				targetBox: {
					width: 260,
					height: 180,
					borderWidth: 2,
					borderColor: theme.primary,
					borderRadius: 12,
					backgroundColor: "transparent",
				},
				guideText: {
					color: theme.text,
					fontSize: 14,
					fontWeight: "600",
					marginBottom: 30,
					backgroundColor: theme.overlay,
					paddingHorizontal: 16,
					paddingVertical: 8,
					borderRadius: 20,
					overflow: "hidden",
				},
			}),
		[theme],
	);

	return (
		<Modal visible={visible} animationType="slide" onRequestClose={onClose}>
			<View style={styles.container}>
				<CameraView
					style={StyleSheet.absoluteFill}
					facing="back"
					onBarcodeScanned={({ data }) => onScanned(data)}
					barcodeScannerSettings={{
						barcodeTypes: ["upc_a", "upc_e", "ean13", "ean8", "code128", "qr"],
					}}
				/>
				<SafeAreaView style={styles.overlay}>
					<TouchableOpacity style={styles.closeButton} onPress={onClose}>
						<Ionicons name="close-circle" size={40} color={theme.text} />
					</TouchableOpacity>
					<View style={styles.targetBox} />
					<Text style={styles.guideText}>Align barcode within the box</Text>
				</SafeAreaView>
			</View>
		</Modal>
	);
}
