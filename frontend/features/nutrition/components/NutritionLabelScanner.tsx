import { useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CameraView } from "expo-camera";
import { recognizeText, type OcrResult } from "expo-ocr-kit";
//used for manipulating the image to ignore background, maybe it helps
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useTheme } from "@/theme/ThemeProvider";
import { parseNutritionLabel, type ParsedNutritionLabel } from "../utils/parseNutritionLabel";

// The on-screen box the label should sit in. The photo is cropped to it before OCR.
const SCREEN = Dimensions.get("window");
const BOX_WIDTH = 280;
const BOX_HEIGHT = 380;
const BOX_X = (SCREEN.width - BOX_WIDTH) / 2;
const BOX_Y = (SCREEN.height - BOX_HEIGHT) / 2;

// Full-screen camera for photographing a nutrition label. Takes the photo, crops it to
// the guide box, reads the text and hands back what it parsed. The caller asks for
// camera permission before opening it.
export function NutritionLabelScanner({ visible, onScanned, onClose }: { visible: boolean; onScanned: (parsed: ParsedNutritionLabel) => void; onClose: () => void }) {
	const { theme } = useTheme();
	const cameraRef = useRef<CameraView>(null);
	const [isReady, setIsReady] = useState(false);

	const handleCapture = async () => {
		if (!cameraRef.current || !isReady) return;

		const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
		onClose();
		setIsReady(false);

		//crop photo before OCR:
		const scaleX = photo.width / SCREEN.width;
		const scaleY = photo.height / SCREEN.height;

		const cropRegion = {
			originX: Math.max(0, BOX_X * scaleX),
			originY: Math.max(0, BOX_Y * scaleY),
			width: Math.min(photo.width, BOX_WIDTH * scaleX),
			height: Math.min(photo.height, BOX_HEIGHT * scaleY),
		};

		const context = ImageManipulator.manipulate(photo.uri);
		context.crop(cropRegion);

		// Render the cropped image result
		const croppedImage = await context.renderAsync();
		const resultImage = await croppedImage.saveAsync({ format: SaveFormat.JPEG });

		// pass the cropped photo into OCR here
		const result: OcrResult = await recognizeText(resultImage.uri);
		onScanned(parseNutritionLabel(result));
	};

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
					width: BOX_WIDTH,
					height: BOX_HEIGHT,
					borderWidth: 2,
					borderColor: theme.primary,
					borderRadius: 12,
				},
				scanButton: {
					backgroundColor: theme.primary,
					borderRadius: 30,
					paddingVertical: 18,
					alignItems: "center",
					justifyContent: "center",
					marginTop: 28,
					marginBottom: 20,
				},
				scanButtonText: {
					color: theme.textInverse,
					fontSize: 14,
					fontWeight: "700",
				},
			}),
		[theme],
	);

	return (
		<Modal visible={visible} animationType="slide" onRequestClose={onClose}>
			<View style={styles.container}>
				<CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setIsReady(true)} />
				<SafeAreaView style={styles.overlay}>
					<TouchableOpacity style={styles.closeButton} onPress={onClose}>
						<Ionicons name="close-circle" size={40} color={theme.text} />
					</TouchableOpacity>
					<View style={styles.targetBox} />
					<TouchableOpacity style={[styles.scanButton, { opacity: isReady ? 1 : 0.5 }]} onPress={handleCapture} disabled={!isReady}>
						<Text style={styles.scanButtonText}>{isReady ? "Scan label" : "Starting camera…"}</Text>
					</TouchableOpacity>
				</SafeAreaView>
			</View>
		</Modal>
	);
}
