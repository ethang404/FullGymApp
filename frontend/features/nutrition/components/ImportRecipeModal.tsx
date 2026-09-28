import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Pressable, Keyboard, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useMemo, useState } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { log } from "@/utils/log";
import type { ImportedRecipe } from "../../../types/nutrition";

interface ImportRecipeModalProps {
	visible: boolean;
	onClose: () => void;
	onImported: (recipe: ImportedRecipe) => void;
}

// Paste a recipe URL -> backend parses the page's schema.org JSON-LD -> we hand
// the caller a normalized ImportedRecipe (name, servings, ingredient strings...).
export default function ImportRecipeModal({ visible, onClose, onImported }: ImportRecipeModalProps) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();

	const [url, setUrl] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// RN's Modal doesn't inherit the activity's adjustResize, so lift the sheet
	// ourselves by the keyboard's height while it's open.
	const [keyboardHeight, setKeyboardHeight] = useState(0);
	useEffect(() => {
		if (!visible) return;
		const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
		const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
		const showSub = Keyboard.addListener(showEvt, (e) => setKeyboardHeight(e.endCoordinates?.height ?? 0));
		const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
		return () => {
			showSub.remove();
			hideSub.remove();
			setKeyboardHeight(0);
		};
	}, [visible]);

	function handleClose() {
		if (loading) return;
		setUrl("");
		setError(null);
		onClose();
	}

	async function handleImport() {
		const trimmed = url.trim();
		if (!trimmed || loading) return;

		setLoading(true);
		setError(null);
		try {
			const res = await instance.post("/nutrition/recipes/import", { url: trimmed });
			const recipe: ImportedRecipe = res.data.recipe ?? res.data;
			onImported(recipe);
			setUrl("");
			onClose();
		} catch (e: any) {
			log.error("Recipe import failed:", e);
			setError(e?.response?.data?.message ?? "Couldn't import that recipe. Check the link and try again.");
		} finally {
			setLoading(false);
		}
	}

	const styles = useMemo(
		() =>
			StyleSheet.create({
				overlay: { flex: 1, justifyContent: "flex-end" },
				backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.overlay },
				card: {
					backgroundColor: theme.cardBg,
					borderTopLeftRadius: 20,
					borderTopRightRadius: 20,
					padding: 20,
				},
				headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
				title: { color: theme.text, fontSize: 18, fontWeight: "700" },
				subtitle: { color: theme.textMuted, fontSize: 13, marginBottom: 16 },
				inputRow: {
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
					backgroundColor: theme.inputBg,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: error ? theme.error : theme.inputBorder,
					borderRadius: 12,
					paddingHorizontal: 14,
					paddingVertical: 10,
				},
				input: { flex: 1, color: theme.text, fontSize: 15 },
				error: { color: theme.error, fontSize: 12, marginTop: 8 },
				importBtn: {
					backgroundColor: theme.primary,
					borderRadius: 12,
					paddingVertical: 14,
					alignItems: "center",
					justifyContent: "center",
					marginTop: 16,
				},
				importBtnText: { color: theme.textInverse, fontSize: 15, fontWeight: "700" },
			}),
		[theme, error],
	);

	return (
		<Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose} statusBarTranslucent>
			<View style={styles.overlay}>
				<Pressable style={styles.backdrop} onPress={handleClose} />
				<View style={[styles.card, { paddingBottom: (keyboardHeight > 0 ? keyboardHeight : insets.bottom) + 20 }]}>
					<View style={styles.headerRow}>
						<Text style={styles.title}>Import from a link</Text>
						<TouchableOpacity onPress={handleClose} hitSlop={10} disabled={loading}>
							<FontAwesome5 name="times" size={20} color={theme.primary} />
						</TouchableOpacity>
					</View>
					<Text style={styles.subtitle}>Paste a recipe page URL and we'll pull out the ingredients and steps.</Text>

					<View style={styles.inputRow}>
						<FontAwesome5 name="link" size={13} color={theme.inputPlaceholder} />
						<TextInput
							style={styles.input}
							placeholder="https://example.com/best-lasagna"
							placeholderTextColor={theme.inputPlaceholder}
							value={url}
							onChangeText={(t) => {
								setUrl(t);
								if (error) setError(null);
							}}
							autoCapitalize="none"
							autoCorrect={false}
							keyboardType="url"
							editable={!loading}
							onSubmitEditing={handleImport}
							returnKeyType="go"
						/>
					</View>

					{error && <Text style={styles.error}>{error}</Text>}

					<TouchableOpacity
						style={[styles.importBtn, (loading || !url.trim()) && { opacity: 0.6 }]}
						onPress={handleImport}
						disabled={loading || !url.trim()}
						activeOpacity={0.85}
					>
						{loading ? <ActivityIndicator color={theme.textInverse} /> : <Text style={styles.importBtnText}>Import Recipe</Text>}
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
}
