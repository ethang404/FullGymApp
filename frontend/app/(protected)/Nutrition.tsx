import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ActivityIndicator,
	SectionList,
	Modal,
	TextInput,
	ScrollView,
	KeyboardAvoidingView,
	Platform,
	Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo, useEffect, useState } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Nutrients {
	calories: number;
	protein: number;
	carbs: number;
	fat: number;
}

interface DiaryEntry {
	id: string;
	type: "food" | "recipe";
	meal_type: string;
	quantity: number;
	unit: string;
	nutrients: Nutrients | null;
	food?: { id: string; name: string; brand?: string };
	recipe?: { id: string; name: string };
}

interface MealSection {
	title: string;
	meal_type: string;
	icon: string;
	data: DiaryEntry[];
	totals: Nutrients;
}

interface FoodSearchResult {
	id: string;
	name: string;
	brand?: string;
	calories_per_100g: number;
	protein_per_100g: number;
	carbs_per_100g: number;
	fat_per_100g: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snacks"];
const MEAL_ICONS: Record<string, string> = {
	breakfast: "sun",
	lunch: "cloud-sun",
	dinner: "moon",
	snacks: "apple-alt",
};

function todayISO() {
	return new Date().toISOString().split("T")[0];
}

function sumNutrients(entries: DiaryEntry[]): Nutrients {
	return entries.reduce(
		(acc, e) => ({
			calories: acc.calories + (e.nutrients?.calories ?? 0),
			protein: acc.protein + (e.nutrients?.protein ?? 0),
			carbs: acc.carbs + (e.nutrients?.carbs ?? 0),
			fat: acc.fat + (e.nutrients?.fat ?? 0),
		}),
		{ calories: 0, protein: 0, carbs: 0, fat: 0 },
	);
}

function groupByMeal(entries: DiaryEntry[]): MealSection[] {
	const map: Record<string, DiaryEntry[]> = {};
	for (const e of entries) {
		const key = e.meal_type.toLowerCase();
		if (!map[key]) map[key] = [];
		map[key].push(e);
	}
	return MEAL_ORDER.map((m) => ({
		title: m.charAt(0).toUpperCase() + m.slice(1),
		meal_type: m,
		icon: MEAL_ICONS[m] ?? "utensils",
		data: map[m] ?? [],
		totals: sumNutrients(map[m] ?? []),
	}));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MacroBar({ label, current, goal, color, textColor }: { label: string; current: number; goal: number; color: string; textColor: string }) {
	const pct = Math.min((current / goal) * 100, 100);
	return (
		<View style={{ flex: 1, gap: 4 }}>
			<View style={{ flexDirection: "row", justifyContent: "space-between" }}>
				<Text style={{ fontSize: 10, fontWeight: "700", color: textColor, letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</Text>
				<Text style={{ fontSize: 10, color: textColor }}>
					{Math.round(current)}/{goal}g
				</Text>
			</View>
			<View style={{ height: 3, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
				<View style={{ height: 3, width: `${pct}%`, backgroundColor: color, borderRadius: 2 }} />
			</View>
		</View>
	);
}

function AddFoodToDatabaseModal({
	visible,
	prefillName = "",
	onClose,
	onSaved,
	theme,
}: {
	visible: boolean;
	prefillName?: string;
	onClose: () => void;
	onSaved: (food: FoodSearchResult) => void;
	theme: any;
}) {
	const [name, setName] = useState(prefillName);
	const [brand, setBrand] = useState("");
	const [calories, setCalories] = useState("");
	const [protein, setProtein] = useState("");
	const [carbs, setCarbs] = useState("");
	const [fat, setFat] = useState("");
	const [saving, setSaving] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [servingSize, setServingSize] = useState("100");
	const [unit, setUnit] = useState("g");

	useEffect(() => {
		if (visible) {
			setName(prefillName);
			setBrand("");
			setCalories("");
			setProtein("");
			setCarbs("");
			setFat("");
			setErrors({});
		}
	}, [visible, prefillName]);

	function validate() {
		const e: Record<string, string> = {};
		if (!name.trim()) e.name = "Name is required";
		if (!calories.trim() || isNaN(Number(calories))) e.calories = "Enter a valid number";
		return e;
	}

	async function handleSave() {
		const e = validate();
		if (Object.keys(e).length > 0) {
			setErrors(e);
			return;
		}
		setSaving(true);
		try {
			const res = await instance.post("/nutrition/foods", {
				name: name.trim(),
				brand: brand.trim() || undefined,
				calories_per_100g: Number(calories),
				protein_per_100g: Number(protein) || 0,
				carbs_per_100g: Number(carbs) || 0,
				fat_per_100g: Number(fat) || 0,

				serving_size: Number(servingSize) || 100,
				serving_unit: unit,
			});
			onSaved(res.data.food);
		} catch (err) {
			console.error("Add food error:", err);
		} finally {
			setSaving(false);
		}
	}

	const input = {
		backgroundColor: theme.cardBgAlt,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: theme.border,
		paddingHorizontal: 14,
		paddingVertical: 11,
		fontSize: 15,
		color: theme.text,
	};
	const label = { fontSize: 11, fontWeight: "700" as const, color: theme.textMuted, letterSpacing: 0.8, textTransform: "uppercase" as const };

	return (
		<Modal visible={visible} transparent animationType="slide">
			<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
				<Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }} onPress={onClose}>
					<Pressable onPress={(e) => e.stopPropagation()}>
						<View
							style={{
								backgroundColor: theme.cardBg,
								borderTopLeftRadius: 20,
								borderTopRightRadius: 20,
								height: "95%",
								borderTopWidth: 1,
								borderColor: theme.border,
							}}
						>
							<View style={{ width: 36, height: 4, backgroundColor: theme.border, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 8 }} />
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									justifyContent: "space-between",
									paddingHorizontal: 16,
									paddingBottom: 14,
									borderBottomWidth: 1,
									borderColor: theme.border,
								}}
							>
								<TouchableOpacity onPress={onClose} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
									<FontAwesome5 name="arrow-left" size={12} color={theme.primary} />
									<Text style={{ fontSize: 13, color: theme.primary }}>Back to search</Text>
								</TouchableOpacity>
								<Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>Add new food</Text>
								<View style={{ width: 90 }} />
							</View>

							<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>
								<View style={{ gap: 4 }}>
									<Text style={label}>Food name *</Text>
									<TextInput
										style={[input, errors.name && { borderColor: theme.error }]}
										value={name}
										onChangeText={setName}
										placeholder="e.g. Brown rice, cooked"
										placeholderTextColor={theme.textTertiary}
									/>
									{errors.name && <Text style={{ fontSize: 11, color: theme.error }}>{errors.name}</Text>}
								</View>
								<View style={{ gap: 4 }}>
									<Text style={label}>Brand (optional)</Text>
									<TextInput style={input} value={brand} onChangeText={setBrand} placeholder="e.g. Tesco, Quaker" placeholderTextColor={theme.textTertiary} />
								</View>
								<View style={{ gap: 4 }}>
									<Text style={label}>Calories per 100g *</Text>
									<TextInput
										style={[input, errors.calories && { borderColor: theme.error }]}
										value={calories}
										onChangeText={setCalories}
										placeholder="e.g. 130"
										placeholderTextColor={theme.textTertiary}
										keyboardType="numeric"
									/>
									{errors.calories && <Text style={{ fontSize: 11, color: theme.error }}>{errors.calories}</Text>}
								</View>
								<Text style={label}>Macros per 100g</Text>
								<View style={{ flexDirection: "row", gap: 10 }}>
									{[
										["Protein (g)", "#4ADE80", protein, setProtein],
										["Carbs (g)", "#38BDF8", carbs, setCarbs],
										["Fat (g)", "#FB923C", fat, setFat],
									].map(([l, c, v, fn]) => (
										<View key={l as string} style={{ flex: 1, gap: 4 }}>
											<Text style={[label, { color: c as string }]}>{l as string}</Text>
											<TextInput
												style={input}
												value={v as string}
												onChangeText={fn as any}
												placeholder="0"
												placeholderTextColor={theme.textTertiary}
												keyboardType="numeric"
											/>
										</View>
									))}
								</View>
								<View style={{ gap: 4 }}>
									<Text style={label}>Serving size</Text>

									<View style={{ flexDirection: "row", gap: 8 }}>
										<TextInput
											style={[input, { flex: 1 }]}
											value={servingSize}
											onChangeText={setServingSize}
											placeholder="e.g. 100"
											keyboardType="numeric"
											placeholderTextColor={theme.textTertiary}
										/>

										<ScrollView horizontal showsHorizontalScrollIndicator={false}>
											{["g", "ml", "oz", "cup", "tbsp", "tsp"].map((u) => (
												<TouchableOpacity
													key={u}
													onPress={() => setUnit(u)}
													style={{
														paddingHorizontal: 12,
														height: 44,
														justifyContent: "center",
														borderRadius: 8,
														borderWidth: 1,
														borderColor: unit === u ? theme.primary : theme.border,
														backgroundColor: unit === u ? theme.primary : "transparent",
														marginRight: 6,
													}}
												>
													<Text
														style={{
															color: unit === u ? theme.textInverse : theme.textMuted,
															fontWeight: "600",
														}}
													>
														{u}
													</Text>
												</TouchableOpacity>
											))}
										</ScrollView>
									</View>
								</View>
								<Text style={{ fontSize: 11, color: theme.textTertiary }}>All values are per 100g.</Text>
							</ScrollView>

							<TouchableOpacity
								onPress={handleSave}
								disabled={saving}
								style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
							>
								{saving ? (
									<ActivityIndicator color={theme.textInverse} />
								) : (
									<Text style={{ fontSize: 15, fontWeight: "700", color: theme.textInverse }}>Save to database</Text>
								)}
							</TouchableOpacity>
						</View>
					</Pressable>
				</Pressable>
			</KeyboardAvoidingView>
		</Modal>
	);
}

function EditEntryModal({
	visible,
	entry,
	onClose,
	onUpdated,
	theme,
}: {
	visible: boolean;
	entry: DiaryEntry | null;
	onClose: () => void;
	onUpdated: () => void;
	theme: any;
}) {
	const [quantity, setQuantity] = useState("");
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);

	useEffect(() => {
		if (visible && entry) setQuantity(String(entry.quantity));
	}, [visible, entry]);

	if (!entry) return null;
	const currentEntry = entry;

	const qty = Number(quantity) || 0;
	const scale = entry.quantity > 0 ? qty / entry.quantity : 0;
	const preview = {
		calories: Math.round((entry.nutrients?.calories ?? 0) * scale),
		protein: Math.round((entry.nutrients?.protein ?? 0) * scale),
		carbs: Math.round((entry.nutrients?.carbs ?? 0) * scale),
		fat: Math.round((entry.nutrients?.fat ?? 0) * scale),
	};
	const per100 = entry.quantity > 0 ? 100 / entry.quantity : 0;
	const ref = {
		calories: Math.round((entry.nutrients?.calories ?? 0) * per100),
		protein: Math.round((entry.nutrients?.protein ?? 0) * per100),
		carbs: Math.round((entry.nutrients?.carbs ?? 0) * per100),
		fat: Math.round((entry.nutrients?.fat ?? 0) * per100),
	};

	async function handleUpdate() {
		setSaving(true);
		try {
			await instance.patch(`/nutrition/diary/${currentEntry.id}`, { quantity: Number(quantity) || currentEntry.quantity, unit: currentEntry.unit });
			onUpdated();
		} catch (err) {
			console.error(err);
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete() {
		setDeleting(true);
		try {
			await instance.delete(`/nutrition/diary/${currentEntry.id}`);
			onUpdated();
		} catch (err) {
			console.error(err);
		} finally {
			setDeleting(false);
		}
	}

	const sectionLabel = {
		fontSize: 11,
		fontWeight: "700" as const,
		color: theme.textMuted,
		letterSpacing: 0.8,
		textTransform: "uppercase" as const,
		marginBottom: 10,
	};

	return (
		<Modal visible={visible} transparent animationType="slide">
			<Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }} onPress={onClose}>
				<Pressable style={{ flex: 1 }} onPress={(e) => e.stopPropagation()}>
					<View
						style={{
							backgroundColor: theme.cardBg,
							borderTopLeftRadius: 20,
							borderTopRightRadius: 20,
							height: "95%",
							borderTopWidth: 1,
							borderColor: theme.border,
						}}
					>
						<View style={{ width: 36, height: 4, backgroundColor: theme.border, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 8 }} />
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
								paddingHorizontal: 16,
								paddingBottom: 14,
								borderBottomWidth: 1,
								borderColor: theme.border,
							}}
						>
							<Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>Edit entry</Text>
							<TouchableOpacity
								onPress={onClose}
								style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.cardBgAlt, alignItems: "center", justifyContent: "center" }}
							>
								<FontAwesome5 name="times" size={12} color={theme.textMuted} />
							</TouchableOpacity>
						</View>

						<ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 20 }} showsVerticalScrollIndicator={false}>
							<Text style={{ fontSize: 20, fontWeight: "800", color: theme.text }}>{entry.food?.name ?? entry.recipe?.name ?? "Unknown"}</Text>
							<Text style={{ fontSize: 13, color: theme.textMuted, marginTop: 2, marginBottom: 16 }}>
								{entry.food?.brand ? `${entry.food.brand} · ` : ""}
								{entry.meal_type.charAt(0).toUpperCase() + entry.meal_type.slice(1)}
							</Text>

							<View style={{ height: 1, backgroundColor: theme.border, marginBottom: 16 }} />

							<Text style={sectionLabel}>Quantity</Text>
							<View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
								<TouchableOpacity
									onPress={() => setQuantity((q) => String(Math.max(10, (Number(q) || 0) - 10)))}
									style={{
										width: 36,
										height: 36,
										borderRadius: 10,
										backgroundColor: theme.cardBgAlt,
										borderWidth: 1,
										borderColor: theme.border,
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<Text style={{ fontSize: 20, color: theme.text }}>−</Text>
								</TouchableOpacity>
								<TextInput
									style={{
										flex: 1,
										textAlign: "center",
										fontSize: 22,
										fontWeight: "700",
										color: theme.text,
										backgroundColor: theme.cardBgAlt,
										borderRadius: 10,
										borderWidth: 1,
										borderColor: theme.border,
										paddingVertical: 8,
									}}
									value={quantity}
									onChangeText={setQuantity}
									keyboardType="numeric"
								/>
								<TouchableOpacity
									onPress={() => setQuantity((q) => String((Number(q) || 0) + 10))}
									style={{
										width: 36,
										height: 36,
										borderRadius: 10,
										backgroundColor: theme.cardBgAlt,
										borderWidth: 1,
										borderColor: theme.border,
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<Text style={{ fontSize: 20, color: theme.text }}>+</Text>
								</TouchableOpacity>
								<Text
									style={{
										fontSize: 15,
										color: theme.textMuted,
										backgroundColor: theme.cardBgAlt,
										borderRadius: 10,
										borderWidth: 1,
										borderColor: theme.border,
										paddingHorizontal: 14,
										paddingVertical: 10,
									}}
								>
									{entry.unit}
								</Text>
							</View>

							<Text style={sectionLabel}>Nutrition preview</Text>
							<View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
								{[
									["kcal", preview.calories, theme.text],
									["protein", `${preview.protein}g`, "#4ADE80"],
									["carbs", `${preview.carbs}g`, "#38BDF8"],
									["fat", `${preview.fat}g`, "#FB923C"],
								].map(([l, v, c]) => (
									<View
										key={l as string}
										style={{
											flex: 1,
											backgroundColor: theme.cardBgAlt,
											borderRadius: 10,
											padding: 10,
											alignItems: "center",
											borderWidth: 1,
											borderColor: theme.border,
										}}
									>
										<Text style={{ fontSize: 18, fontWeight: "800", color: c as string }}>{v}</Text>
										<Text style={{ fontSize: 10, color: theme.textMuted, marginTop: 2, textTransform: "uppercase" }}>{l}</Text>
									</View>
								))}
							</View>

							<Text style={sectionLabel}>Per 100g reference</Text>
							{[
								["Calories", `${ref.calories} kcal`],
								["Protein", `${ref.protein}g`],
								["Carbohydrates", `${ref.carbs}g`],
								["Fat", `${ref.fat}g`],
							].map(([l, v], i, arr) => (
								<View
									key={l}
									style={{
										flexDirection: "row",
										justifyContent: "space-between",
										paddingVertical: 10,
										borderBottomWidth: i < arr.length - 1 ? 1 : 0,
										borderColor: theme.border,
									}}
								>
									<Text style={{ fontSize: 14, color: theme.textSecondary }}>{l}</Text>
									<Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }}>{v}</Text>
								</View>
							))}
						</ScrollView>

						<View style={{ padding: 16, gap: 10 }}>
							<TouchableOpacity
								onPress={handleUpdate}
								disabled={saving}
								style={{ backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
							>
								{saving ? (
									<ActivityIndicator color={theme.textInverse} />
								) : (
									<Text style={{ fontSize: 15, fontWeight: "700", color: theme.textInverse }}>Save changes</Text>
								)}
							</TouchableOpacity>
							<TouchableOpacity
								onPress={handleDelete}
								disabled={deleting}
								style={{ borderWidth: 1, borderColor: theme.error, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
							>
								{deleting ? (
									<ActivityIndicator color={theme.error} />
								) : (
									<Text style={{ fontSize: 15, fontWeight: "600", color: theme.error }}>Remove from diary</Text>
								)}
							</TouchableOpacity>
						</View>
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

function LogFoodModal({
	visible,
	defaultMealType = "breakfast",
	onClose,
	onLogged,
	theme,
}: {
	visible: boolean;
	defaultMealType?: string;
	onClose: () => void;
	onLogged: () => void;
	theme: any;
}) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<FoodSearchResult[]>([]);
	const [searching, setSearching] = useState(false);
	const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null);
	const [quantity, setQuantity] = useState("100");
	const [mealType, setMealType] = useState(defaultMealType);
	const [logging, setLogging] = useState(false);
	const [addFoodVisible, setAddFoodVisible] = useState(false);

	useEffect(() => {
		if (visible) {
			setMealType(defaultMealType);
			setQuery("");
			setResults([]);
			setSelectedFood(null);
			setQuantity("100");
		}
	}, [visible, defaultMealType]);

	useEffect(() => {
		if (!query.trim()) {
			setResults([]);
			return;
		}
		const timer = setTimeout(async () => {
			setSearching(true);
			try {
				const res = await instance.get(`/nutrition/foods?q=${encodeURIComponent(query)}`);
				setResults(res.data.foods ?? []);
			} catch (err) {
				console.error("Food search error:", err);
			} finally {
				setSearching(false);
			}
		}, 400);
		return () => clearTimeout(timer);
	}, [query]);

	async function handleLog() {
		if (!selectedFood) return;
		setLogging(true);
		try {
			await instance.post("/nutrition/diary", {
				food_id: selectedFood.id,
				meal_type: mealType,
				quantity: Number(quantity) || 100,
				unit: "g",
			});
			onLogged();
		} catch (err) {
			console.error("Log food error:", err);
		} finally {
			setLogging(false);
		}
	}

	const qty = Number(quantity) || 0;
	const previewCalories = selectedFood ? Math.round((selectedFood.calories_per_100g * qty) / 100) : null;
	const previewProtein = selectedFood ? Math.round((selectedFood.protein_per_100g * qty) / 100) : null;
	const showNoResults = query.trim().length > 0 && !searching && results.length === 0;

	return (
		<>
			<Modal visible={visible} transparent animationType="slide">
				<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
					<Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }} onPress={onClose}>
						<Pressable onPress={(e) => e.stopPropagation()}>
							<View
								style={{
									backgroundColor: theme.cardBg,
									borderTopLeftRadius: 20,
									borderTopRightRadius: 20,
									height: "95%",
									borderTopWidth: 1,
									borderColor: theme.border,
								}}
							>
								{/* Handle */}
								<View style={{ width: 36, height: 4, backgroundColor: theme.border, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 8 }} />

								{/* Header */}
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										justifyContent: "space-between",
										paddingHorizontal: 16,
										paddingBottom: 14,
										borderBottomWidth: 1,
										borderColor: theme.border,
									}}
								>
									<Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>Log food</Text>
									<TouchableOpacity
										onPress={onClose}
										style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.cardBgAlt, alignItems: "center", justifyContent: "center" }}
									>
										<FontAwesome5 name="times" size={12} color={theme.textMuted} />
									</TouchableOpacity>
								</View>

								{/* Meal tabs */}
								<ScrollView
									horizontal
									showsHorizontalScrollIndicator={false}
									contentContainerStyle={{ flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 4, alignItems: "center" }}
								>
									{MEAL_ORDER.map((m) => (
										<TouchableOpacity
											key={m}
											onPress={() => setMealType(m)}
											style={{
												paddingHorizontal: 12,
												height: 32,
												justifyContent: "center",
												borderRadius: 20,
												borderWidth: 1,
												borderColor: mealType === m ? theme.primary : theme.border,
												backgroundColor: mealType === m ? theme.primary : "transparent",
											}}
										>
											<Text style={{ fontSize: 12, fontWeight: "600", color: mealType === m ? theme.textInverse : theme.textMuted }}>
												{m.charAt(0).toUpperCase() + m.slice(1)}
											</Text>
										</TouchableOpacity>
									))}
								</ScrollView>

								{/* Search bar */}
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: 8,
										backgroundColor: theme.cardBgAlt,
										borderRadius: 10,
										marginHorizontal: 16,
										marginTop: 10,
										marginBottom: 4,
										paddingHorizontal: 12,
										borderWidth: 1,
										borderColor: theme.border,
									}}
								>
									<FontAwesome5 name="search" size={13} color={theme.textMuted} />
									<TextInput
										style={{ flex: 1, fontSize: 15, color: theme.text, paddingVertical: 11 }}
										value={query}
										onChangeText={(t) => {
											setQuery(t);
											if (selectedFood) setSelectedFood(null);
										}}
										placeholder="Search food or barcode…"
										placeholderTextColor={theme.textTertiary}
										autoFocus
									/>
									{searching && <ActivityIndicator size="small" color={theme.primary} />}
									{query.length > 0 && !searching && (
										<TouchableOpacity
											onPress={() => {
												setQuery("");
												setResults([]);
												setSelectedFood(null);
											}}
										>
											<FontAwesome5 name="times-circle" size={14} color={theme.textMuted} />
										</TouchableOpacity>
									)}
								</View>

								<ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
									{/* Results list */}
									{results.map((food) => (
										<TouchableOpacity
											key={food.id}
											onPress={() => setSelectedFood(food)}
											style={{
												flexDirection: "row",
												alignItems: "center",
												paddingHorizontal: 16,
												paddingVertical: 11,
												borderBottomWidth: 1,
												borderColor: theme.border,
												...(selectedFood?.id === food.id && { backgroundColor: theme.primary + "15", borderLeftWidth: 3, borderLeftColor: theme.primary }),
											}}
										>
											<View style={{ flex: 1 }}>
												<Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }}>{food.name}</Text>
												<Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 1 }}>
													per 100g · P: {food.protein_per_100g}g{food.brand ? ` · ${food.brand}` : ""}
												</Text>
											</View>
											<Text style={{ fontSize: 13, fontWeight: "700", color: theme.primary, marginRight: 10 }}>{food.calories_per_100g} kcal</Text>
											{selectedFood?.id === food.id ? (
												<View
													style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center" }}
												>
													<FontAwesome5 name="check" size={10} color={theme.textInverse} />
												</View>
											) : (
												<View
													style={{
														width: 22,
														height: 22,
														borderRadius: 11,
														borderWidth: 1.5,
														borderColor: theme.primary,
														alignItems: "center",
														justifyContent: "center",
													}}
												>
													<FontAwesome5 name="plus" size={10} color={theme.primary} />
												</View>
											)}
										</TouchableOpacity>
									))}

									{/* No results */}
									{showNoResults && (
										<View style={{ paddingHorizontal: 16, paddingVertical: 20, alignItems: "center", gap: 10 }}>
											<Text style={{ fontSize: 14, color: theme.textMuted }}>No results for "{query}"</Text>
											<TouchableOpacity
												onPress={() => setAddFoodVisible(true)}
												style={{
													flexDirection: "row",
													alignItems: "center",
													gap: 8,
													borderWidth: 1,
													borderColor: theme.primary,
													borderRadius: 10,
													paddingHorizontal: 16,
													paddingVertical: 10,
												}}
											>
												<FontAwesome5 name="plus" size={12} color={theme.primary} />
												<Text style={{ fontSize: 14, fontWeight: "600", color: theme.primary }}>Add "{query}" to database</Text>
											</TouchableOpacity>
										</View>
									)}

									{/* Empty state */}
									{!query && !selectedFood && (
										<View style={{ paddingHorizontal: 16, paddingVertical: 20, alignItems: "center", gap: 10 }}>
											<Text style={{ fontSize: 14, color: theme.textMuted }}>Search for a food above, or</Text>
											<TouchableOpacity
												onPress={() => setAddFoodVisible(true)}
												style={{
													flexDirection: "row",
													alignItems: "center",
													gap: 8,
													borderWidth: 1,
													borderColor: theme.primary,
													borderRadius: 10,
													paddingHorizontal: 16,
													paddingVertical: 10,
												}}
											>
												<FontAwesome5 name="plus" size={12} color={theme.primary} />
												<Text style={{ fontSize: 14, fontWeight: "600", color: theme.primary }}>Add a new food to database</Text>
											</TouchableOpacity>
										</View>
									)}

									{/* Selected food + quantity */}
									{selectedFood && (
										<View
											style={{
												backgroundColor: theme.cardBgAlt,
												marginHorizontal: 16,
												marginTop: 10,
												borderRadius: 12,
												padding: 14,
												borderWidth: 1,
												borderColor: theme.border,
												gap: 12,
											}}
										>
											<Text style={{ fontSize: 15, fontWeight: "700", color: theme.text }}>{selectedFood.name}</Text>
											<View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
												<Text style={{ fontSize: 13, color: theme.textMuted, flex: 1 }}>Quantity</Text>
												<TouchableOpacity
													onPress={() => setQuantity((q) => String(Math.max(10, (Number(q) || 100) - 10)))}
													style={{
														width: 30,
														height: 30,
														borderRadius: 8,
														backgroundColor: theme.cardBg,
														borderWidth: 1,
														borderColor: theme.border,
														alignItems: "center",
														justifyContent: "center",
													}}
												>
													<Text style={{ fontSize: 18, color: theme.text, lineHeight: 20 }}>−</Text>
												</TouchableOpacity>
												<TextInput
													style={{
														width: 56,
														textAlign: "center",
														fontSize: 16,
														fontWeight: "700",
														color: theme.text,
														backgroundColor: theme.cardBg,
														borderRadius: 8,
														borderWidth: 1,
														borderColor: theme.border,
														paddingVertical: 6,
													}}
													value={quantity}
													onChangeText={setQuantity}
													keyboardType="numeric"
												/>
												<TouchableOpacity
													onPress={() => setQuantity((q) => String((Number(q) || 100) + 10))}
													style={{
														width: 30,
														height: 30,
														borderRadius: 8,
														backgroundColor: theme.cardBg,
														borderWidth: 1,
														borderColor: theme.border,
														alignItems: "center",
														justifyContent: "center",
													}}
												>
													<Text style={{ fontSize: 18, color: theme.text, lineHeight: 20 }}>+</Text>
												</TouchableOpacity>
												<Text
													style={{
														fontSize: 13,
														color: theme.textMuted,
														backgroundColor: theme.cardBg,
														borderRadius: 8,
														borderWidth: 1,
														borderColor: theme.border,
														paddingHorizontal: 10,
														paddingVertical: 7,
													}}
												>
													g
												</Text>
											</View>
											<View style={{ flexDirection: "row", gap: 10 }}>
												<View
													style={{
														flex: 1,
														backgroundColor: theme.cardBg,
														borderRadius: 8,
														padding: 8,
														alignItems: "center",
														borderWidth: 1,
														borderColor: theme.border,
													}}
												>
													<Text style={{ fontSize: 15, fontWeight: "700", color: theme.text }}>{previewCalories}</Text>
													<Text style={{ fontSize: 10, color: theme.textMuted, marginTop: 2, textTransform: "uppercase" }}>kcal</Text>
												</View>
												<View
													style={{
														flex: 1,
														backgroundColor: theme.cardBg,
														borderRadius: 8,
														padding: 8,
														alignItems: "center",
														borderWidth: 1,
														borderColor: theme.border,
													}}
												>
													<Text style={{ fontSize: 15, fontWeight: "700", color: "#4ADE80" }}>{previewProtein}g</Text>
													<Text style={{ fontSize: 10, color: theme.textMuted, marginTop: 2, textTransform: "uppercase" }}>protein</Text>
												</View>
											</View>
										</View>
									)}
								</ScrollView>

								{/* Log button */}
								<TouchableOpacity
									onPress={handleLog}
									disabled={!selectedFood || logging}
									style={{
										margin: 16,
										backgroundColor: theme.primary,
										borderRadius: 12,
										paddingVertical: 14,
										alignItems: "center",
										opacity: !selectedFood ? 0.4 : 1,
									}}
								>
									{logging ? (
										<ActivityIndicator color={theme.textInverse} />
									) : (
										<Text style={{ fontSize: 15, fontWeight: "700", color: theme.textInverse }}>
											Add to {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
										</Text>
									)}
								</TouchableOpacity>
							</View>
						</Pressable>
					</Pressable>
				</KeyboardAvoidingView>
			</Modal>

			<AddFoodToDatabaseModal
				visible={addFoodVisible}
				prefillName={query}
				onClose={() => setAddFoodVisible(false)}
				onSaved={(food) => {
					setAddFoodVisible(false);
					setSelectedFood(food);
					setQuery(food.name);
					setResults([]);
				}}
				theme={theme}
			/>
		</>
	);
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function Nutrition() {
	const { theme } = useTheme();
	const [entries, setEntries] = useState<DiaryEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);

	const [logModalVisible, setLogModalVisible] = useState(false);
	const [activeMealType, setActiveMealType] = useState("breakfast");
	const [editEntry, setEditEntry] = useState<DiaryEntry | null>(null);

	// Goals: ideally come from user profile later
	const goals = { calories: 2500, protein: 180, carbs: 250, fat: 75 };

	async function fetchEntries() {
		try {
			const today = todayISO();
			const res = await instance.get(`/nutrition/diary?start_date=${today}&end_date=${today}`);
			console.log("What does res look like?");
			console.log(res.data.diary_entries);
			console.log("--------");
			setEntries(res.data.diary_entries ?? []);
		} catch (e) {
			console.error("Nutrition fetch error:", e);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}

	useEffect(() => {
		fetchEntries();
	}, []);

	const sections = useMemo(() => groupByMeal(entries), [entries]);
	const dayTotals = useMemo(() => sumNutrients(entries), [entries]);
	const remaining = goals.calories - dayTotals.calories;

	function openLogModal(mealType?: string) {
		if (mealType) setActiveMealType(mealType);
		setLogModalVisible(true);
	}

	function handleFoodLogged() {
		setLogModalVisible(false);
		fetchEntries();
	}

	function handleEntryUpdated() {
		setEditEntry(null);
		fetchEntries();
	}

	const styles = useMemo(
		() =>
			StyleSheet.create({
				safe: { flex: 1, backgroundColor: theme.background },

				// Summary hero card
				heroCard: {
					backgroundColor: theme.cardBg,
					marginHorizontal: 16,
					marginTop: 12,
					marginBottom: 16,
					borderRadius: 16,
					padding: 18,
					borderWidth: 1,
					borderColor: theme.border,
				},
				heroTop: {
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "flex-start",
					marginBottom: 14,
				},
				remainLabel: {
					fontSize: 11,
					fontWeight: "700",
					color: theme.textMuted,
					letterSpacing: 1.5,
					textTransform: "uppercase",
				},
				remainNumber: {
					fontSize: 44,
					fontWeight: "800",
					color: remaining >= 0 ? theme.text : theme.error,
					lineHeight: 48,
				},
				goalText: {
					fontSize: 13,
					color: theme.textMuted,
					marginTop: 2,
				},
				goalEaten: {
					fontSize: 13,
					color: theme.textMuted,
				},
				macroRow: {
					flexDirection: "row",
					gap: 12,
				},

				// Page header
				pageHeader: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					paddingHorizontal: 16,
					paddingTop: 16,
					paddingBottom: 4,
				},
				pageTitle: {
					fontSize: 22,
					fontWeight: "800",
					color: theme.text,
				},
				addBtn: {
					flexDirection: "row",
					alignItems: "center",
					gap: 6,
					backgroundColor: theme.primary,
					paddingHorizontal: 14,
					paddingVertical: 8,
					borderRadius: 10,
				},
				addBtnText: {
					fontSize: 12,
					fontWeight: "700",
					color: theme.textInverse,
					textTransform: "uppercase",
					letterSpacing: 0.5,
				},

				// Section header
				sectionHeader: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					backgroundColor: theme.background,
					paddingHorizontal: 16,
					paddingTop: 16,
					paddingBottom: 8,
				},
				sectionLeft: {
					flexDirection: "row",
					alignItems: "center",
					gap: 10,
				},
				sectionIconWrap: {
					width: 34,
					height: 34,
					borderRadius: 10,
					backgroundColor: theme.cardBgAlt,
					alignItems: "center",
					justifyContent: "center",
					borderWidth: 1,
					borderColor: theme.border,
				},
				sectionTitle: {
					fontSize: 15,
					fontWeight: "700",
					color: theme.text,
				},
				sectionMeta: {
					fontSize: 12,
					color: theme.textMuted,
					marginTop: 1,
				},
				sectionAddBtn: {
					width: 28,
					height: 28,
					borderRadius: 8,
					borderWidth: 1,
					borderColor: theme.primary,
					alignItems: "center",
					justifyContent: "center",
				},

				// Entry row
				entryCard: {
					flexDirection: "row",
					alignItems: "center",
					marginHorizontal: 16,
					marginBottom: 2,
					backgroundColor: theme.cardBg,
					borderRadius: 12,
					paddingHorizontal: 14,
					paddingVertical: 12,
					borderWidth: 1,
					borderColor: theme.border,
				},
				entryName: {
					fontSize: 15,
					fontWeight: "600",
					color: theme.text,
					flex: 1,
				},
				entryMeta: {
					fontSize: 12,
					color: theme.textMuted,
					marginTop: 2,
				},
				entryCalories: {
					fontSize: 15,
					fontWeight: "700",
					color: theme.text,
					marginLeft: 12,
				},

				emptyMeal: {
					marginHorizontal: 16,
					marginBottom: 2,
					paddingVertical: 14,
					paddingHorizontal: 14,
					backgroundColor: theme.cardBg,
					borderRadius: 12,
					borderWidth: 1,
					borderColor: theme.border,
					borderStyle: "dashed",
					alignItems: "center",
				},
				emptyMealText: {
					fontSize: 13,
					color: theme.textTertiary,
				},
			}),
		[theme, remaining],
	);

	if (loading) {
		return (
			<SafeAreaView style={[styles.safe, { justifyContent: "center", alignItems: "center" }]}>
				<ActivityIndicator color={theme.primary} size="large" />
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<SectionList
				sections={sections}
				keyExtractor={(item) => item.id}
				showsVerticalScrollIndicator={false}
				stickySectionHeadersEnabled={false}
				onRefresh={fetchEntries}
				refreshing={refreshing}
				ListHeaderComponent={
					<>
						{/* Page header */}
						<View style={styles.pageHeader}>
							<Text style={styles.pageTitle}>Nutrition</Text>
							<TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={() => openLogModal()}>
								<FontAwesome5 name="search" size={11} color={theme.textInverse} />
								<Text style={styles.addBtnText}>Find Food</Text>
							</TouchableOpacity>
						</View>

						{/* Hero summary card */}
						<View style={styles.heroCard}>
							<View style={styles.heroTop}>
								<View>
									<Text style={styles.remainLabel}>Remaining</Text>
									<Text style={styles.remainNumber}>{remaining.toLocaleString()}</Text>
									<Text style={styles.goalText}>Goal: {goals.calories.toLocaleString()} kcal</Text>
								</View>
								<Text style={styles.goalEaten}>{dayTotals.calories.toLocaleString()} eaten</Text>
							</View>
							<View style={styles.macroRow}>
								<MacroBar label="Protein" current={dayTotals.protein} goal={goals.protein} color="#4ADE80" textColor={theme.textSecondary} />
								<MacroBar label="Carbs" current={dayTotals.carbs} goal={goals.carbs} color="#38BDF8" textColor={theme.textSecondary} />
								<MacroBar label="Fat" current={dayTotals.fat} goal={goals.fat} color="#FB923C" textColor={theme.textSecondary} />
							</View>
						</View>
					</>
				}
				renderSectionHeader={({ section }) => (
					<View style={styles.sectionHeader}>
						<View style={styles.sectionLeft}>
							<View style={styles.sectionIconWrap}>
								<FontAwesome5 name={section.icon} size={14} color={theme.primary} />
							</View>
							<View>
								<Text style={styles.sectionTitle}>{section.title}</Text>
								<Text style={styles.sectionMeta}>
									{section.totals.calories > 0
										? `${Math.round(section.totals.calories)} kcal · P: ${Math.round(section.totals.protein)}g · C: ${Math.round(section.totals.carbs)}g · F: ${Math.round(section.totals.fat)}g`
										: "No entries yet"}
								</Text>
							</View>
						</View>
						<TouchableOpacity style={styles.sectionAddBtn} activeOpacity={0.7} onPress={() => openLogModal(section.meal_type)}>
							<FontAwesome5 name="plus" size={12} color={theme.primary} />
						</TouchableOpacity>
					</View>
				)}
				renderItem={({ item }) => (
					<TouchableOpacity style={styles.entryCard} onPress={() => setEditEntry(item)}>
						<View style={{ flex: 1 }}>
							<Text style={styles.entryName}>{item.food?.name ?? item.recipe?.name ?? "Unknown"}</Text>
							<Text style={styles.entryMeta}>
								{item.quantity} {item.unit}
								{item.food?.brand ? ` · ${item.food.brand}` : ""}
							</Text>
						</View>
						<Text style={styles.entryCalories}>{Math.round(item.nutrients?.calories ?? 0)}</Text>
					</TouchableOpacity>
				)}
				renderSectionFooter={({ section }) =>
					section.data.length === 0 ? (
						<TouchableOpacity style={styles.emptyMeal} activeOpacity={0.6} onPress={() => openLogModal(section.meal_type)}>
							<Text style={styles.emptyMealText}>+ Log {section.title}</Text>
						</TouchableOpacity>
					) : null
				}
				contentContainerStyle={{ paddingBottom: 32 }}
			/>
			<LogFoodModal
				visible={logModalVisible}
				defaultMealType={activeMealType}
				onClose={() => setLogModalVisible(false)}
				onLogged={handleFoodLogged}
				theme={theme}
			/>

			<EditEntryModal visible={editEntry !== null} entry={editEntry} onClose={() => setEditEntry(null)} onUpdated={handleEntryUpdated} theme={theme} />
		</SafeAreaView>
	);
}
