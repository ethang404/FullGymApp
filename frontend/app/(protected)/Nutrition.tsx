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
	Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo, useEffect, useState, useRef } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { instance } from "@/utils/AxiosInterceptorHandler";
import { CameraView, useCameraPermissions } from "expo-camera";

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
	/** Food entries: { [nutrient_id]: amount_string }. Recipe entries: named Nutrients object. */
	nutrients: Record<number, string> | Nutrients | null;
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
	foodNutrients?: { nutrient_id: number; amount_per_100g: string }[];
	foodServingSizes?: { label: string; weight_g: number }[];
	default_serving?: {
		label: string;
		weight_g: number;
		macros: Record<number, string>;
	};
}

// ─── Nutrient map (mirrors backend NUTRIENT_MAP) ──────────────────────────────

const NUTRIENT_MAP: Record<string, { nutrient_id: number; nutrient_name: string; unit: string; label: string }> = {
	calories: { nutrient_id: 1008, nutrient_name: "Energy", unit: "kcal", label: "Calories" },
	protein: { nutrient_id: 1003, nutrient_name: "Protein", unit: "g", label: "Protein" },
	fat: { nutrient_id: 1004, nutrient_name: "Total lipid (fat)", unit: "g", label: "Total Fat" },
	carbs: { nutrient_id: 1005, nutrient_name: "Carbohydrate, by difference", unit: "g", label: "Carbohydrates" },
	fiber: { nutrient_id: 1079, nutrient_name: "Fiber, total dietary", unit: "g", label: "Fiber" },
	sugar: { nutrient_id: 2000, nutrient_name: "Sugars, total including NLEA", unit: "g", label: "Total Sugars" },
	added_sugar: { nutrient_id: 1235, nutrient_name: "Sugars, added", unit: "g", label: "Added Sugars" },
	saturated_fat: { nutrient_id: 1258, nutrient_name: "Fatty acids, total saturated", unit: "g", label: "Saturated Fat" },
	trans_fat: { nutrient_id: 1257, nutrient_name: "Fatty acids, total trans", unit: "g", label: "Trans Fat" },
	polyunsaturated_fat: { nutrient_id: 1293, nutrient_name: "Fatty acids, total polyunsaturated", unit: "g", label: "Polyunsaturated Fat" },
	monounsaturated_fat: { nutrient_id: 1292, nutrient_name: "Fatty acids, total monounsaturated", unit: "g", label: "Monounsaturated Fat" },
	sodium: { nutrient_id: 1093, nutrient_name: "Sodium, Na", unit: "mg", label: "Sodium" },
	cholesterol: { nutrient_id: 1253, nutrient_name: "Cholesterol", unit: "mg", label: "Cholesterol" },
	calcium: { nutrient_id: 1087, nutrient_name: "Calcium, Ca", unit: "mg", label: "Calcium" },
	iron: { nutrient_id: 1089, nutrient_name: "Iron, Fe", unit: "mg", label: "Iron" },
	potassium: { nutrient_id: 1092, nutrient_name: "Potassium, K", unit: "mg", label: "Potassium" },
	magnesium: { nutrient_id: 1090, nutrient_name: "Magnesium, Mg", unit: "mg", label: "Magnesium" },
	phosphorus: { nutrient_id: 1091, nutrient_name: "Phosphorus, P", unit: "mg", label: "Phosphorus" },
	zinc: { nutrient_id: 1095, nutrient_name: "Zinc, Zn", unit: "mg", label: "Zinc" },
	vitamin_a: { nutrient_id: 1106, nutrient_name: "Vitamin A, RAE", unit: "µg", label: "Vitamin A" },
	vitamin_c: { nutrient_id: 1162, nutrient_name: "Vitamin C, total ascorbic acid", unit: "mg", label: "Vitamin C" },
	vitamin_d: { nutrient_id: 1114, nutrient_name: "Vitamin D (D2 + D3)", unit: "µg", label: "Vitamin D" },
	vitamin_e: { nutrient_id: 1109, nutrient_name: "Vitamin E (alpha-tocopherol)", unit: "mg", label: "Vitamin E" },
	vitamin_k: { nutrient_id: 1185, nutrient_name: "Vitamin K (phylloquinone)", unit: "µg", label: "Vitamin K" },
	vitamin_b6: { nutrient_id: 1175, nutrient_name: "Vitamin B-6", unit: "mg", label: "Vitamin B6" },
	vitamin_b12: { nutrient_id: 1178, nutrient_name: "Vitamin B-12", unit: "µg", label: "Vitamin B12" },
	folate: { nutrient_id: 1177, nutrient_name: "Folate, total", unit: "µg", label: "Folate" },
	thiamin: { nutrient_id: 1165, nutrient_name: "Thiamin", unit: "mg", label: "Thiamin" },
	riboflavin: { nutrient_id: 1166, nutrient_name: "Riboflavin", unit: "mg", label: "Riboflavin" },
	niacin: { nutrient_id: 1167, nutrient_name: "Niacin", unit: "mg", label: "Niacin" },
	water: { nutrient_id: 1051, nutrient_name: "Water", unit: "g", label: "Water" },
	alcohol: { nutrient_id: 1018, nutrient_name: "Alcohol, ethyl", unit: "g", label: "Alcohol" },
	caffeine: { nutrient_id: 1057, nutrient_name: "Caffeine", unit: "mg", label: "Caffeine" },
};

// Grouped sections for the custom food nutrient form
const NUTRIENT_SECTIONS = [
	{ title: "Core Macros", required: true, keys: ["calories", "protein", "carbs", "fat"] },
	{ title: "Carbohydrates", required: false, keys: ["fiber", "sugar", "added_sugar"] },
	{ title: "Fats", required: false, keys: ["saturated_fat", "trans_fat", "polyunsaturated_fat", "monounsaturated_fat"] },
	{ title: "Minerals", required: false, keys: ["sodium", "cholesterol", "calcium", "iron", "potassium", "magnesium", "phosphorus", "zinc"] },
	{
		title: "Vitamins",
		required: false,
		keys: ["vitamin_a", "vitamin_c", "vitamin_d", "vitamin_e", "vitamin_k", "vitamin_b6", "vitamin_b12", "folate", "thiamin", "riboflavin", "niacin"],
	},
	{ title: "Other", required: false, keys: ["water", "alcohol", "caffeine"] },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snacks"];
const MEAL_ICONS: Record<string, string> = { breakfast: "sun", lunch: "cloud-sun", dinner: "moon", snacks: "apple-alt" };
const SERVING_PRESETS = ["g", "kg", "oz", "cup", "tbsp", "tsp", "piece", "slice", "scoop", "serving", "handful", "packet"];
const MAX_SERVINGS = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
	return new Date().toISOString().split("T")[0];
}

function extractMacros(nutrients: Record<number, string> | Nutrients | null): Nutrients {
	if (!nutrients) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
	if ("calories" in nutrients) return nutrients as Nutrients;
	const n = nutrients as Record<number, string>;
	return {
		calories: parseFloat(String(n[1008] ?? 0)) || 0,
		protein: parseFloat(String(n[1003] ?? 0)) || 0,
		carbs: parseFloat(String(n[1005] ?? 0)) || 0,
		fat: parseFloat(String(n[1004] ?? 0)) || 0,
	};
}

function sumNutrients(entries: DiaryEntry[]): Nutrients {
	return entries.reduce(
		(acc, e) => {
			const m = extractMacros(e.nutrients);
			return { calories: acc.calories + m.calories, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat };
		},
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

function getPer100g(food: FoodSearchResult, nutrient_id: number): number {
	const n = food.foodNutrients?.find((fn) => fn.nutrient_id === nutrient_id);
	return n ? parseFloat(n.amount_per_100g) || 0 : 0;
}

// ─── MacroBar ─────────────────────────────────────────────────────────────────

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

// ─── PresetPicker ─────────────────────────────────────────────────────────────

function PresetPicker({ value, onSelect, usedLabels, theme }: { value: string; onSelect: (l: string) => void; usedLabels: string[]; theme: any }) {
	const [open, setOpen] = useState(false);
	return (
		<View>
			<TouchableOpacity
				onPress={() => setOpen(true)}
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					backgroundColor: theme.cardBgAlt,
					borderRadius: 10,
					borderWidth: 1,
					borderColor: theme.border,
					paddingHorizontal: 12,
					paddingVertical: 11,
					gap: 6,
					minWidth: 90,
				}}
			>
				<Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }}>{value}</Text>
				<FontAwesome5 name="chevron-down" size={10} color={theme.textMuted} />
			</TouchableOpacity>
			<Modal visible={open} transparent animationType="fade">
				<Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 40 }} onPress={() => setOpen(false)}>
					<Pressable onPress={(e) => e.stopPropagation()}>
						<View style={{ backgroundColor: theme.cardBg, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: "hidden" }}>
							<View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: theme.border }}>
								<Text style={{ fontSize: 13, fontWeight: "700", color: theme.textMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>Select unit</Text>
							</View>
							{SERVING_PRESETS.map((p, i) => {
								const isUsed = usedLabels.includes(p) && p !== value;
								return (
									<TouchableOpacity
										key={p}
										onPress={() => {
											if (!isUsed) {
												onSelect(p);
												setOpen(false);
											}
										}}
										style={{
											flexDirection: "row",
											alignItems: "center",
											justifyContent: "space-between",
											paddingHorizontal: 16,
											paddingVertical: 13,
											borderBottomWidth: i < SERVING_PRESETS.length - 1 ? 1 : 0,
											borderColor: theme.border,
											opacity: isUsed ? 0.35 : 1,
										}}
									>
										<Text style={{ fontSize: 15, color: p === value ? theme.primary : theme.text, fontWeight: p === value ? "700" : "400" }}>{p}</Text>
										{p === value && <FontAwesome5 name="check" size={12} color={theme.primary} />}
									</TouchableOpacity>
								);
							})}
						</View>
					</Pressable>
				</Pressable>
			</Modal>
		</View>
	);
}

// ─── AddFoodToDatabaseModal ───────────────────────────────────────────────────

interface ServingRow {
	id: number;
	label: string;
	quantity: string;
	weight_g: string;
}

export function AddFoodToDatabaseModal({
	visible,
	prefillName = "",
	onClose,
	onSaved,
	theme,
}: {
	visible: boolean;
	prefillName?: string;
	onClose: () => void;
	onSaved: (food: any) => void;
	theme: any;
}) {
	const [foodName, setFoodName] = useState(prefillName);
	const [brand, setBrand] = useState("");
	const [barcode, setBarcode] = useState("");
	const [referenceId, setReferenceId] = useState(1);
	const [servings, setServings] = useState<ServingRow[]>([{ id: 1, label: "g", quantity: "100", weight_g: "" }]);
	const [nextId, setNextId] = useState(2);
	const [nutrientValues, setNutrientValues] = useState<Record<string, string>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [saving, setSaving] = useState(false);
	const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ "Core Macros": true });

	useEffect(() => {
		if (!visible) return;
		setFoodName(prefillName);
		setBrand("");
		setBarcode("");
		setReferenceId(1);
		setServings([{ id: 1, label: "g", quantity: "100", weight_g: "" }]);
		setNextId(2);
		setNutrientValues({});
		setErrors({});
		setExpandedSections({ "Core Macros": true });
	}, [visible, prefillName]);

	const usedLabels = servings.map((s) => s.label);
	const referenceRow = servings.find((s) => s.id === referenceId) ?? servings[0];

	function resolveGrams(row: ServingRow): number {
		return row.label === "g" ? parseFloat(row.quantity) || 0 : parseFloat(row.weight_g) || 0;
	}

	function addServing() {
		if (servings.length >= MAX_SERVINGS) return;
		const next = SERVING_PRESETS.find((p) => !usedLabels.includes(p));
		setServings((prev) => [...prev, { id: nextId, label: next ?? "cup", quantity: "1", weight_g: "" }]);
		setNextId((n) => n + 1);
	}

	function updateServing(id: number, field: keyof ServingRow, value: string) {
		setServings((prev) =>
			prev.map((s) => {
				if (s.id !== id) return s;
				const u = { ...s, [field]: value };
				if (field === "label" && value === "g") u.weight_g = "";
				return u;
			}),
		);
	}

	function removeServing(id: number) {
		setServings((prev) => prev.filter((s) => s.id !== id));
		if (referenceId === id) setReferenceId(servings.filter((s) => s.id !== id)[0]?.id ?? -1);
	}

	function toggleSection(title: string) {
		setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));
	}

	function validate(): Record<string, string> {
		const e: Record<string, string> = {};
		if (!foodName.trim()) e.name = "Required";
		if (!nutrientValues["calories"]?.trim() || isNaN(Number(nutrientValues["calories"]))) e.calories = "Required";
		servings.forEach((s) => {
			if (!s.quantity || isNaN(parseFloat(s.quantity)) || parseFloat(s.quantity) <= 0) e[`qty_${s.id}`] = "Required";
			if (s.label !== "g" && (!s.weight_g || isNaN(parseFloat(s.weight_g)) || parseFloat(s.weight_g) <= 0)) e[`wt_${s.id}`] = "Enter gram weight";
		});
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
			const serving_sizes = servings.map((s) => ({ label: s.label, weight_g: resolveGrams(s) }));
			const nutrients = Object.entries(nutrientValues)
				.filter(([, val]) => val.trim() !== "" && !isNaN(Number(val)))
				.map(([key]) => {
					const meta = NUTRIENT_MAP[key];
					return {
						nutrient_id: meta.nutrient_id,
						nutrient_name: key,
						unit: meta.unit,
						nutrient_amount: Number(nutrientValues[key]),
					};
				});

			const payload = {
				name: foodName.trim(),
				brand: brand.trim() || undefined,
				barcode: barcode.trim() || undefined,
				nutrients,
				serving_sizes,
				serving: { quantity: parseFloat(referenceRow.quantity), unit: referenceRow.label },
			};

			const res = await instance.post("/nutrition/foods", payload);
			onSaved(res.data.food ?? res.data);
		} catch (err) {
			console.error("Add food error:", err);
		} finally {
			setSaving(false);
		}
	}

	const inp = (extra?: object) => ({
		backgroundColor: theme.cardBgAlt,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: theme.border,
		paddingHorizontal: 14,
		paddingVertical: 11,
		fontSize: 15,
		color: theme.text,
		...(extra ?? {}),
	});
	const lbl = { fontSize: 11, fontWeight: "700" as const, color: theme.textMuted, letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 6 };
	const errTxt = { fontSize: 11, color: theme.error, marginTop: 3 };
	const divider = { height: 1, backgroundColor: theme.border, marginVertical: 16 };

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
								<TouchableOpacity onPress={onClose} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
									<FontAwesome5 name="arrow-left" size={12} color={theme.primary} />
									<Text style={{ fontSize: 13, color: theme.primary }}>Back</Text>
								</TouchableOpacity>
								<Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>Create Custom Food</Text>
								<View style={{ width: 60 }} />
							</View>

							<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
								{/* ── Basic Info ── */}
								<Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 2 }}>Basic Info</Text>

								<View style={{ gap: 4 }}>
									<Text style={lbl}>Food name *</Text>
									<TextInput
										style={[inp(), errors.name && { borderColor: theme.error }]}
										value={foodName}
										onChangeText={setFoodName}
										placeholder="e.g. Brown Rice, Oat Milk"
										placeholderTextColor={theme.textTertiary}
									/>
									{errors.name && <Text style={errTxt}>{errors.name}</Text>}
								</View>

								<View style={{ flexDirection: "row", gap: 10 }}>
									<View style={{ flex: 1, gap: 4 }}>
										<Text style={lbl}>Brand (optional)</Text>
										<TextInput style={inp()} value={brand} onChangeText={setBrand} placeholder="e.g. Quaker" placeholderTextColor={theme.textTertiary} />
									</View>
									<View style={{ flex: 1, gap: 4 }}>
										<Text style={lbl}>Barcode (optional)</Text>
										<TextInput
											style={inp()}
											value={barcode}
											onChangeText={setBarcode}
											placeholder="012345"
											placeholderTextColor={theme.textTertiary}
											keyboardType="numeric"
										/>
									</View>
								</View>

								<View style={divider} />

								{/* ── Serving Sizes ── */}
								<View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
									<View style={{ flex: 1 }}>
										<Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 2 }}>Serving Sizes</Text>
										<Text style={{ fontSize: 12, color: theme.textMuted, marginBottom: 10 }}>
											Select which serving your nutrition label uses, then add others.
										</Text>
									</View>
									{servings.length < MAX_SERVINGS && (
										<TouchableOpacity
											onPress={addServing}
											style={{
												flexDirection: "row",
												alignItems: "center",
												gap: 5,
												paddingHorizontal: 10,
												paddingVertical: 6,
												borderRadius: 8,
												borderWidth: 1,
												borderColor: theme.primary,
											}}
										>
											<FontAwesome5 name="plus" size={10} color={theme.primary} />
											<Text style={{ fontSize: 12, color: theme.primary, fontWeight: "600" }}>Add</Text>
										</TouchableOpacity>
									)}
								</View>

								{servings.map((row) => {
									const isGrams = row.label === "g";
									const isRef = row.id === referenceId;
									return (
										<View
											key={row.id}
											style={{
												borderRadius: 12,
												borderWidth: 1.5,
												borderColor: isRef ? theme.primary : theme.border,
												backgroundColor: isRef ? theme.primary + "08" : theme.cardBgAlt,
												padding: 12,
												gap: 10,
											}}
										>
											<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
												<TouchableOpacity onPress={() => setReferenceId(row.id)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
													<View
														style={{
															width: 18,
															height: 18,
															borderRadius: 9,
															borderWidth: 2,
															borderColor: isRef ? theme.primary : theme.border,
															alignItems: "center",
															justifyContent: "center",
														}}
													>
														{isRef && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary }} />}
													</View>
													<Text style={{ fontSize: 12, fontWeight: "600", color: isRef ? theme.primary : theme.textMuted }}>
														{isRef ? "Macros entered for this serving" : "Set as macro reference"}
													</Text>
												</TouchableOpacity>
												{servings.length > 1 && (
													<TouchableOpacity onPress={() => removeServing(row.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
														<FontAwesome5 name="times" size={12} color={theme.textMuted} />
													</TouchableOpacity>
												)}
											</View>
											<View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
												<View style={{ gap: 4 }}>
													<Text style={lbl}>Unit</Text>
													<PresetPicker value={row.label} onSelect={(l) => updateServing(row.id, "label", l)} usedLabels={usedLabels} theme={theme} />
												</View>
												<View style={{ width: 72, gap: 4 }}>
													<Text style={lbl}>Qty</Text>
													<TextInput
														style={[inp(), errors[`qty_${row.id}`] && { borderColor: theme.error }]}
														value={row.quantity}
														onChangeText={(v) => updateServing(row.id, "quantity", v)}
														keyboardType="numeric"
														placeholder="1"
														placeholderTextColor={theme.textTertiary}
													/>
													{errors[`qty_${row.id}`] && <Text style={errTxt}>{errors[`qty_${row.id}`]}</Text>}
												</View>
												{!isGrams && (
													<View style={{ flex: 1, gap: 4 }}>
														<Text style={lbl}>= grams</Text>
														<TextInput
															style={[inp(), errors[`wt_${row.id}`] && { borderColor: theme.error }]}
															value={row.weight_g}
															onChangeText={(v) => updateServing(row.id, "weight_g", v)}
															keyboardType="numeric"
															placeholder="e.g. 240"
															placeholderTextColor={theme.textTertiary}
														/>
														{errors[`wt_${row.id}`] && <Text style={errTxt}>{errors[`wt_${row.id}`]}</Text>}
													</View>
												)}
											</View>
											<Text style={{ fontSize: 12, color: isRef ? theme.primary : theme.textMuted }}>
												{isGrams ? `${row.quantity || "?"} g` : `${row.quantity || "?"} ${row.label}${row.weight_g ? ` = ${row.weight_g} g` : ""}`}
											</Text>
										</View>
									);
								})}

								<View style={divider} />

								{/* ── Nutrition Label ── */}
								<View style={{ marginBottom: 4 }}>
									<Text style={{ fontSize: 14, fontWeight: "700", color: theme.text }}>
										Nutrition for{" "}
										<Text style={{ color: theme.primary }}>
											{referenceRow.label === "g"
												? `${referenceRow.quantity || "?"} g`
												: `${referenceRow.quantity || "?"} ${referenceRow.label}${referenceRow.weight_g ? ` (${referenceRow.weight_g} g)` : ""}`}
										</Text>
									</Text>
									<Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Copy values from the nutrition label. Only Calories is required.</Text>
								</View>

								{NUTRIENT_SECTIONS.map((section) => {
									const isExpanded = expandedSections[section.title] ?? false;
									const filledCount = section.keys.filter((k) => nutrientValues[k]?.trim()).length;
									return (
										<View key={section.title} style={{ borderRadius: 12, borderWidth: 1, borderColor: theme.border, overflow: "hidden", marginBottom: 2 }}>
											<TouchableOpacity
												onPress={() => toggleSection(section.title)}
												style={{
													flexDirection: "row",
													alignItems: "center",
													justifyContent: "space-between",
													paddingHorizontal: 14,
													paddingVertical: 12,
													backgroundColor: theme.cardBgAlt,
												}}
											>
												<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
													<Text style={{ fontSize: 14, fontWeight: "700", color: theme.text }}>{section.title}</Text>
													{section.required && (
														<View style={{ backgroundColor: theme.primary + "22", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
															<Text style={{ fontSize: 10, color: theme.primary, fontWeight: "700" }}>REQUIRED</Text>
														</View>
													)}
													{filledCount > 0 && !isExpanded && (
														<View style={{ backgroundColor: theme.primary + "33", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
															<Text style={{ fontSize: 10, color: theme.primary, fontWeight: "700" }}>
																{filledCount}/{section.keys.length} filled
															</Text>
														</View>
													)}
												</View>
												<FontAwesome5 name={isExpanded ? "chevron-up" : "chevron-down"} size={11} color={theme.textMuted} />
											</TouchableOpacity>

											{isExpanded && (
												<View style={{ padding: 14, gap: 10 }}>
													{section.keys.includes("calories") &&
														(() => {
															return (
																<View style={{ gap: 4 }}>
																	<Text style={lbl}>Calories (kcal) *</Text>
																	<TextInput
																		style={[inp(), errors.calories && { borderColor: theme.error }]}
																		value={nutrientValues["calories"] ?? ""}
																		onChangeText={(v) => setNutrientValues((p) => ({ ...p, calories: v }))}
																		placeholder="e.g. 150"
																		placeholderTextColor={theme.textTertiary}
																		keyboardType="numeric"
																	/>
																	{errors.calories && <Text style={errTxt}>{errors.calories}</Text>}
																</View>
															);
														})()}

													{(() => {
														const others = section.keys.filter((k) => k !== "calories");
														const rows: string[][] = [];
														for (let i = 0; i < others.length; i += 2) rows.push(others.slice(i, i + 2));
														return rows.map((pair, ri) => (
															<View key={ri} style={{ flexDirection: "row", gap: 10 }}>
																{pair.map((key) => {
																	const meta = NUTRIENT_MAP[key];
																	return (
																		<View key={key} style={{ flex: 1, gap: 4 }}>
																			<Text style={lbl} numberOfLines={1}>
																				{meta.label} ({meta.unit})
																			</Text>
																			<TextInput
																				style={inp()}
																				value={nutrientValues[key] ?? ""}
																				onChangeText={(v) => setNutrientValues((p) => ({ ...p, [key]: v }))}
																				placeholder="0"
																				placeholderTextColor={theme.textTertiary}
																				keyboardType="numeric"
																			/>
																		</View>
																	);
																})}
																{pair.length === 1 && <View style={{ flex: 1 }} />}
															</View>
														));
													})()}
												</View>
											)}
										</View>
									);
								})}

								<View style={{ height: 24 }} />
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

// ─── BarcodeScannerModal ──────────────────────────────────────────────────────

function BarcodeScannerModal({
	visible,
	onClose,
	onScanned,
	theme,
}: {
	visible: boolean;
	onClose: () => void;
	onScanned: (barcode: string) => void;
	theme: any;
}) {
	const [permission, requestPermission] = useCameraPermissions();
	const scannedRef = useRef(false);

	// Reset the scanned guard each time the modal opens
	useEffect(() => {
		if (visible) scannedRef.current = false;
	}, [visible]);

	async function ensurePermission() {
		if (!permission?.granted) {
			const result = await requestPermission();
			if (!result.granted) {
				Alert.alert("Camera access required", "Please allow camera access in Settings to scan barcodes.");
			}
		}
	}

	useEffect(() => {
		if (visible) ensurePermission();
	}, [visible]);

	function handleBarcodeScanned({ data }: { data: string }) {
		if (scannedRef.current) return;
		scannedRef.current = true;
		onScanned(data);
	}

	if (!visible) return null;

	return (
		<Modal visible={visible} animationType="slide" statusBarTranslucent>
			<View style={{ flex: 1, backgroundColor: "#000" }}>
				{permission?.granted ? (
					<CameraView
						style={{ flex: 1 }}
						facing="back"
						barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"] }}
						onBarcodeScanned={handleBarcodeScanned}
					>
						{/* Dark overlay with cutout hint */}
						<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
							{/* Top overlay */}
							<View style={{ position: "absolute", top: 0, left: 0, right: 0, height: "30%", backgroundColor: "rgba(0,0,0,0.55)" }} />
							{/* Bottom overlay */}
							<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35%", backgroundColor: "rgba(0,0,0,0.55)" }} />
							{/* Left overlay */}
							<View style={{ position: "absolute", top: "30%", bottom: "35%", left: 0, width: "8%", backgroundColor: "rgba(0,0,0,0.55)" }} />
							{/* Right overlay */}
							<View style={{ position: "absolute", top: "30%", bottom: "35%", right: 0, width: "8%", backgroundColor: "rgba(0,0,0,0.55)" }} />

							{/* Scan frame */}
							<View
								style={{
									width: "84%",
									aspectRatio: 2.2,
									borderRadius: 12,
									borderWidth: 2,
									borderColor: theme.primary,
									shadowColor: theme.primary,
									shadowOpacity: 0.6,
									shadowRadius: 8,
								}}
							>
								{/* Corner accents */}
								{[
									{ top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
									{ top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
									{ bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
									{ bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
								].map((s, i) => (
									<View key={i} style={[{ position: "absolute", width: 24, height: 24, borderColor: theme.primary }, s]} />
								))}
							</View>

							{/* Hint text below frame */}
							<View style={{ position: "absolute", bottom: "28%", alignItems: "center", gap: 6 }}>
								<FontAwesome5 name="barcode" size={18} color="rgba(255,255,255,0.6)" />
								<Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "600" }}>Align barcode within the frame</Text>
							</View>
						</View>
					</CameraView>
				) : (
					<View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16, paddingHorizontal: 32 }}>
						<FontAwesome5 name="camera" size={40} color="rgba(255,255,255,0.4)" />
						<Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center" }}>Camera permission required</Text>
						<Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, textAlign: "center" }}>Allow camera access to scan barcodes.</Text>
						<TouchableOpacity
							onPress={requestPermission}
							style={{ backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
						>
							<Text style={{ color: "#fff", fontWeight: "700" }}>Grant Permission</Text>
						</TouchableOpacity>
					</View>
				)}

				{/* Close button */}
				<TouchableOpacity
					onPress={onClose}
					style={{
						position: "absolute",
						top: Platform.OS === "ios" ? 56 : 24,
						right: 20,
						width: 40,
						height: 40,
						borderRadius: 20,
						backgroundColor: "rgba(0,0,0,0.6)",
						alignItems: "center",
						justifyContent: "center",
						borderWidth: 1,
						borderColor: "rgba(255,255,255,0.2)",
					}}
				>
					<FontAwesome5 name="times" size={14} color="#fff" />
				</TouchableOpacity>

				{/* Title bar */}
				<View
					style={{
						position: "absolute",
						top: Platform.OS === "ios" ? 56 : 24,
						left: 20,
						right: 80,
					}}
				>
					<Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>Scan Barcode</Text>
					<Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>Food will be looked up automatically</Text>
				</View>
			</View>
		</Modal>
	);
}

// ─── EditEntryModal ───────────────────────────────────────────────────────────

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

	const macros = extractMacros(entry.nutrients);
	const qty = Number(quantity) || 0;
	const scale = entry.quantity > 0 ? qty / entry.quantity : 0;
	const preview = {
		calories: Math.round(macros.calories * scale),
		protein: Math.round(macros.protein * scale),
		carbs: Math.round(macros.carbs * scale),
		fat: Math.round(macros.fat * scale),
	};
	const per100 = entry.quantity > 0 ? 100 / entry.quantity : 0;
	const ref100 = {
		calories: Math.round(macros.calories * per100),
		protein: Math.round(macros.protein * per100),
		carbs: Math.round(macros.carbs * per100),
		fat: Math.round(macros.fat * per100),
	};

	async function handleUpdate() {
		setSaving(true);
		try {
			await instance.patch(`/nutrition/diary/${entry!.id}`, { quantity: Number(quantity) || entry!.quantity, unit: entry!.unit });
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
			await instance.delete(`/nutrition/diary/${entry!.id}`);
			onUpdated();
		} catch (err) {
			console.error(err);
		} finally {
			setDeleting(false);
		}
	}

	const sL = { fontSize: 11, fontWeight: "700" as const, color: theme.textMuted, letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 10 };

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
							<Text style={sL}>Quantity</Text>
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
							<Text style={sL}>Nutrition preview</Text>
							<View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
								{(
									[
										["kcal", preview.calories, theme.text],
										["protein", `${preview.protein}g`, "#4ADE80"],
										["carbs", `${preview.carbs}g`, "#38BDF8"],
										["fat", `${preview.fat}g`, "#FB923C"],
									] as [string, any, string][]
								).map(([l, v, c]) => (
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
										<Text style={{ fontSize: 18, fontWeight: "800", color: c }}>{v}</Text>
										<Text style={{ fontSize: 10, color: theme.textMuted, marginTop: 2, textTransform: "uppercase" }}>{l}</Text>
									</View>
								))}
							</View>
							<Text style={sL}>Per 100g reference</Text>
							{(
								[
									["Calories", `${ref100.calories} kcal`],
									["Protein", `${ref100.protein}g`],
									["Carbohydrates", `${ref100.carbs}g`],
									["Fat", `${ref100.fat}g`],
								] as [string, string][]
							).map(([l, v], i, arr) => (
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

// ─── FoodCard ─────────────────────────────────────────────────────────────────

function FoodCard({ food, selected, onPress, theme }: { food: FoodSearchResult; selected: boolean; onPress: () => void; theme: any }) {
	const serving = food.default_serving;
	const cal = Math.round(parseFloat(serving?.macros[1008] ?? "0"));
	const protein = Math.round(parseFloat(serving?.macros[1003] ?? "0"));
	const carbs = Math.round(parseFloat(serving?.macros[1005] ?? "0"));
	const fat = Math.round(parseFloat(serving?.macros[1004] ?? "0"));
	const label = serving?.label ?? "100g";

	return (
		<TouchableOpacity
			onPress={onPress}
			activeOpacity={0.75}
			style={{
				flexDirection: "row",
				alignItems: "center",
				paddingHorizontal: 16,
				paddingVertical: 13,
				borderBottomWidth: 1,
				borderColor: theme.border,
				backgroundColor: selected ? theme.primary + "12" : "transparent",
				borderLeftWidth: selected ? 3 : 0,
				borderLeftColor: selected ? theme.primary : "transparent",
			}}
		>
			<View style={{ flex: 1, gap: 3 }}>
				<View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
					<Text style={{ fontSize: 15, fontWeight: "700", color: theme.text }} numberOfLines={1}>
						{food.name}
					</Text>
					{food.brand && <Text style={{ fontSize: 11, color: theme.textMuted }}>· {food.brand}</Text>}
				</View>
				<Text style={{ fontSize: 11, color: theme.textTertiary }}>{label}</Text>
				<View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
					<Text style={{ fontSize: 11 }}>
						<Text style={{ fontWeight: "700", color: "#4ADE80" }}>{protein}g</Text>
						<Text style={{ color: theme.textMuted }}> P</Text>
					</Text>
					<Text style={{ fontSize: 11 }}>
						<Text style={{ fontWeight: "700", color: "#38BDF8" }}>{carbs}g</Text>
						<Text style={{ color: theme.textMuted }}> C</Text>
					</Text>
					<Text style={{ fontSize: 11 }}>
						<Text style={{ fontWeight: "700", color: "#FB923C" }}>{fat}g</Text>
						<Text style={{ color: theme.textMuted }}> F</Text>
					</Text>
					<Text style={{ fontSize: 11, color: theme.textTertiary }}>per 100g</Text>
				</View>
			</View>
			<View style={{ alignItems: "flex-end", gap: 8 }}>
				<Text style={{ fontSize: 15, fontWeight: "800", color: theme.primary }}>
					{cal}
					<Text style={{ fontSize: 10, fontWeight: "400", color: theme.textMuted }}> kcal</Text>
				</Text>
				<View
					style={{
						width: 26,
						height: 26,
						borderRadius: 13,
						backgroundColor: selected ? theme.primary : "transparent",
						borderWidth: selected ? 0 : 1.5,
						borderColor: theme.primary,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<FontAwesome5 name={selected ? "check" : "plus"} size={10} color={selected ? theme.textInverse : theme.primary} />
				</View>
			</View>
		</TouchableOpacity>
	);
}

// ─── LogFoodModal ─────────────────────────────────────────────────────────────

function LogFoodModal({
	visible,
	defaultMealType = "breakfast",
	logDate,
	onClose,
	onLogged,
	theme,
}: {
	visible: boolean;
	defaultMealType?: string;
	logDate: string;
	onClose: () => void;
	onLogged: () => void;
	theme: any;
}) {
	const [tab, setTab] = useState<"recent" | "frequent">("recent");
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<FoodSearchResult[]>([]);
	const [searching, setSearching] = useState(false);
	const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null);
	const [quantity, setQuantity] = useState("100");
	const [selectedUnit, setSelectedUnit] = useState("g");
	const [mealType, setMealType] = useState(defaultMealType);
	const [logging, setLogging] = useState(false);
	const [addFoodVisible, setAddFoodVisible] = useState(false);
	const [scannerVisible, setScannerVisible] = useState(false);
	const [barcodeSearching, setBarcodeSearching] = useState(false);
	const [barcodeNotFound, setBarcodeNotFound] = useState<string | null>(null);
	const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (visible) {
			setMealType(defaultMealType);
			setQuery("");
			setResults([]);
			setSelectedFood(null);
			setQuantity("100");
			setSelectedUnit("g");
			setTab("recent");
			setBarcodeNotFound(null);
		}
	}, [visible, defaultMealType]);

	// Auto-set unit when food is selected
	useEffect(() => {
		if (!selectedFood) return;
		const firstServing = selectedFood.foodServingSizes?.[0];
		if (firstServing) {
			setSelectedUnit(firstServing.label);
			setQuantity(firstServing.label === "g" ? "100" : "1");
		} else {
			setSelectedUnit("g");
			setQuantity("100");
		}
	}, [selectedFood]);

	// Debounced search
	useEffect(() => {
		if (searchTimer.current) clearTimeout(searchTimer.current);
		if (!query.trim()) {
			setResults([]);
			return;
		}
		searchTimer.current = setTimeout(async () => {
			if (!query.trim()) return;
			setSearching(true);
			try {
				const res = await instance.get(`/nutrition/foods?q=${encodeURIComponent(query.trim())}`);
				setResults(res.data.foods ?? []);
			} catch (err) {
				console.error("Food search error:", err);
			} finally {
				setSearching(false);
			}
		}, 400);
		return () => {
			if (searchTimer.current) clearTimeout(searchTimer.current);
		};
	}, [query]);

	// ── Barcode scan handler ──────────────────────────────────────────────────
	async function handleBarcodeScanned(barcode: string) {
		setScannerVisible(false);
		setBarcodeNotFound(null);
		setBarcodeSearching(true);
		setQuery(barcode);

		try {
			const res = await instance.get(`/nutrition/foods?q=${encodeURIComponent(barcode)}`);
			const foods: FoodSearchResult[] = res.data.foods ?? [];
			if (foods.length > 0) {
				setResults(foods);
				setSelectedFood(foods[0]); // auto-select first match
			} else {
				setResults([]);
				setBarcodeNotFound(barcode);
			}
		} catch (err) {
			console.error("Barcode lookup error:", err);
		} finally {
			setBarcodeSearching(false);
		}
	}

	async function handleLog() {
		if (!selectedFood) return;
		setLogging(true);
		try {
			await instance.post("/nutrition/diary", {
				food_id: selectedFood.id,
				meal_type: mealType,
				logged_at: logDate,
				quantity: Number(quantity) || 100,
				unit: selectedUnit,
			});
			onLogged();
		} catch (err) {
			console.error("Log food error:", err);
		} finally {
			setLogging(false);
		}
	}

	const qty = Number(quantity) || 0;
	const cal100 = selectedFood ? getPer100g(selectedFood, 1008) : 0;
	const prot100 = selectedFood ? getPer100g(selectedFood, 1003) : 0;
	const carb100 = selectedFood ? getPer100g(selectedFood, 1005) : 0;
	const fat100 = selectedFood ? getPer100g(selectedFood, 1004) : 0;

	const gramsForQty = (() => {
		if (!selectedFood || selectedUnit === "g") return qty;
		const ss = selectedFood.foodServingSizes?.find((s) => s.label === selectedUnit);
		return ss ? qty * ss.weight_g : qty;
	})();

	const previewCal = Math.round((cal100 * gramsForQty) / 100);
	const previewProt = Math.round((prot100 * gramsForQty) / 100);
	const previewCarbs = Math.round((carb100 * gramsForQty) / 100);
	const previewFat = Math.round((fat100 * gramsForQty) / 100);

	const showNoResults = query.trim().length > 0 && !searching && !barcodeSearching && results.length === 0;
	const availableUnits = selectedFood?.foodServingSizes?.map((s) => s.label) ?? ["g"];
	const listData = query.trim() ? results : [];

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
								<View style={{ width: 36, height: 4, backgroundColor: theme.border, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 8 }} />

								{/* Header */}
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										justifyContent: "space-between",
										paddingHorizontal: 16,
										paddingBottom: 12,
										borderBottomWidth: 1,
										borderColor: theme.border,
									}}
								>
									<Text style={{ fontSize: 18, fontWeight: "800", color: theme.text }}>Log Food</Text>
									<View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
										{/* Barcode scanner button */}
										<TouchableOpacity
											onPress={() => setScannerVisible(true)}
											style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center" }}
										>
											{barcodeSearching ? (
												<ActivityIndicator size="small" color={theme.textInverse} />
											) : (
												<FontAwesome5 name="barcode" size={15} color={theme.textInverse} />
											)}
										</TouchableOpacity>
										<TouchableOpacity
											onPress={onClose}
											style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.cardBgAlt, alignItems: "center", justifyContent: "center" }}
										>
											<FontAwesome5 name="times" size={12} color={theme.textMuted} />
										</TouchableOpacity>
									</View>
								</View>

								{/* Meal type pill tabs */}
								<ScrollView
									horizontal
									showsHorizontalScrollIndicator={false}
									contentContainerStyle={{ flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center" }}
								>
									{MEAL_ORDER.map((m) => (
										<TouchableOpacity
											key={m}
											onPress={() => setMealType(m)}
											style={{
												paddingHorizontal: 14,
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
										borderRadius: 12,
										marginHorizontal: 16,
										marginBottom: 8,
										paddingHorizontal: 12,
										borderWidth: 1,
										borderColor: theme.border,
									}}
								>
									<FontAwesome5 name="search" size={13} color={theme.textMuted} />
									<TextInput
										style={{ flex: 1, fontSize: 15, color: theme.text, paddingVertical: 12 }}
										value={query}
										onChangeText={(t) => {
											setQuery(t);
											setBarcodeNotFound(null);
											if (selectedFood) setSelectedFood(null);
										}}
										placeholder="Search foods, brands, or recipes…"
										placeholderTextColor={theme.textTertiary}
										autoFocus
									/>
									{(searching || barcodeSearching) && <ActivityIndicator size="small" color={theme.primary} />}
									{query.length > 0 && !searching && !barcodeSearching && (
										<TouchableOpacity
											onPress={() => {
												setQuery("");
												setResults([]);
												setSelectedFood(null);
												setBarcodeNotFound(null);
											}}
										>
											<FontAwesome5 name="times-circle" size={14} color={theme.textMuted} />
										</TouchableOpacity>
									)}
								</View>

								{/* Recent / Frequent tabs */}
								{!query.trim() && (
									<View style={{ flexDirection: "row", paddingHorizontal: 16, borderBottomWidth: 1, borderColor: theme.border }}>
										{(["recent", "frequent"] as const).map((t) => (
											<TouchableOpacity
												key={t}
												onPress={() => setTab(t)}
												style={{
													paddingBottom: 10,
													paddingHorizontal: 2,
													marginRight: 20,
													borderBottomWidth: 2,
													borderColor: tab === t ? theme.primary : "transparent",
												}}
											>
												<Text
													style={{
														fontSize: 13,
														fontWeight: "700",
														color: tab === t ? theme.primary : theme.textMuted,
														textTransform: "uppercase",
														letterSpacing: 0.8,
													}}
												>
													{t}
												</Text>
											</TouchableOpacity>
										))}
									</View>
								)}

								<ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
									{listData.map((food) => (
										<FoodCard
											key={food.id}
											food={food}
											selected={selectedFood?.id === food.id}
											onPress={() => setSelectedFood(selectedFood?.id === food.id ? null : food)}
											theme={theme}
										/>
									))}

									{/* Barcode not found banner */}
									{barcodeNotFound && !barcodeSearching && (
										<View style={{ paddingHorizontal: 16, paddingVertical: 28, alignItems: "center", gap: 12 }}>
											<FontAwesome5 name="barcode" size={28} color={theme.textTertiary} />
											<Text style={{ fontSize: 15, color: theme.textMuted, fontWeight: "600", textAlign: "center" }}>No food found for barcode</Text>
											<Text style={{ fontSize: 12, color: theme.textTertiary }}>{barcodeNotFound}</Text>
											<TouchableOpacity
												onPress={() => {
													setBarcodeNotFound(null);
													setAddFoodVisible(true);
												}}
												style={{
													flexDirection: "row",
													alignItems: "center",
													gap: 8,
													borderWidth: 1.5,
													borderColor: theme.primary,
													borderRadius: 12,
													paddingHorizontal: 18,
													paddingVertical: 11,
												}}
											>
												<FontAwesome5 name="plus" size={12} color={theme.primary} />
												<Text style={{ fontSize: 14, fontWeight: "700", color: theme.primary }}>Create Custom Food</Text>
											</TouchableOpacity>
										</View>
									)}

									{/* No text-search results */}
									{showNoResults && !barcodeNotFound && (
										<View style={{ paddingHorizontal: 16, paddingVertical: 28, alignItems: "center", gap: 12 }}>
											<FontAwesome5 name="search" size={28} color={theme.textTertiary} />
											<Text style={{ fontSize: 15, color: theme.textMuted, fontWeight: "600" }}>No results for "{query}"</Text>
											<TouchableOpacity
												onPress={() => setAddFoodVisible(true)}
												style={{
													flexDirection: "row",
													alignItems: "center",
													gap: 8,
													borderWidth: 1.5,
													borderColor: theme.primary,
													borderRadius: 12,
													paddingHorizontal: 18,
													paddingVertical: 11,
												}}
											>
												<FontAwesome5 name="plus" size={12} color={theme.primary} />
												<Text style={{ fontSize: 14, fontWeight: "700", color: theme.primary }}>Create Custom Food</Text>
											</TouchableOpacity>
										</View>
									)}

									{/* Empty state */}
									{!query.trim() && listData.length === 0 && (
										<View style={{ paddingHorizontal: 16, paddingTop: 28, paddingBottom: 16, alignItems: "center", gap: 12 }}>
											<FontAwesome5 name="utensils" size={28} color={theme.textTertiary} />
											<Text style={{ fontSize: 14, color: theme.textMuted, textAlign: "center" }}>
												{tab === "recent"
													? "No recently logged foods yet.\nSearch above to get started."
													: "Log foods regularly to see your most frequent items here."}
											</Text>
										</View>
									)}

									{listData.length > 0 && (
										<View style={{ paddingVertical: 24, alignItems: "center", gap: 6 }}>
											<Text style={{ fontSize: 12, color: theme.textMuted }}>Can't find your food?</Text>
											<TouchableOpacity onPress={() => setAddFoodVisible(true)}>
												<Text style={{ fontSize: 13, fontWeight: "700", color: theme.primary, textDecorationLine: "underline" }}>Create Custom Food</Text>
											</TouchableOpacity>
										</View>
									)}
								</ScrollView>

								{/* Selected food panel */}
								{selectedFood && (
									<View
										style={{
											backgroundColor: theme.cardBgAlt,
											marginHorizontal: 16,
											marginBottom: 8,
											borderRadius: 14,
											padding: 14,
											borderWidth: 1,
											borderColor: theme.border,
											gap: 10,
										}}
									>
										<Text style={{ fontSize: 15, fontWeight: "700", color: theme.text }} numberOfLines={1}>
											{selectedFood.name}
										</Text>
										<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
											<TouchableOpacity
												onPress={() => setQuantity((q) => String(Math.max(1, (Number(q) || 1) - 1)))}
												style={{
													width: 32,
													height: 32,
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
													width: 58,
													textAlign: "center",
													fontSize: 17,
													fontWeight: "700",
													color: theme.text,
													backgroundColor: theme.cardBg,
													borderRadius: 8,
													borderWidth: 1,
													borderColor: theme.border,
													paddingVertical: 5,
												}}
												value={quantity}
												onChangeText={setQuantity}
												keyboardType="numeric"
											/>
											<TouchableOpacity
												onPress={() => setQuantity((q) => String((Number(q) || 0) + 1))}
												style={{
													width: 32,
													height: 32,
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
											<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}>
												{availableUnits.map((u) => (
													<TouchableOpacity
														key={u}
														onPress={() => setSelectedUnit(u)}
														style={{
															paddingHorizontal: 12,
															height: 32,
															justifyContent: "center",
															borderRadius: 8,
															borderWidth: 1,
															borderColor: selectedUnit === u ? theme.primary : theme.border,
															backgroundColor: selectedUnit === u ? theme.primary + "20" : "transparent",
														}}
													>
														<Text style={{ fontSize: 12, fontWeight: "600", color: selectedUnit === u ? theme.primary : theme.textMuted }}>{u}</Text>
													</TouchableOpacity>
												))}
											</ScrollView>
										</View>
										<View style={{ flexDirection: "row", gap: 8 }}>
											{(
												[
													["kcal", previewCal, theme.text],
													["protein", `${previewProt}g`, "#4ADE80"],
													["carbs", `${previewCarbs}g`, "#38BDF8"],
													["fat", `${previewFat}g`, "#FB923C"],
												] as [string, any, string][]
											).map(([l, v, c]) => (
												<View
													key={l as string}
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
													<Text style={{ fontSize: 14, fontWeight: "800", color: c }}>{v}</Text>
													<Text style={{ fontSize: 9, color: theme.textMuted, marginTop: 1, textTransform: "uppercase" }}>{l}</Text>
												</View>
											))}
										</View>
									</View>
								)}

								{/* Log button */}
								<TouchableOpacity
									onPress={handleLog}
									disabled={!selectedFood || logging}
									style={{
										marginHorizontal: 16,
										marginBottom: 16,
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

			{/* Barcode Scanner */}
			<BarcodeScannerModal visible={scannerVisible} onClose={() => setScannerVisible(false)} onScanned={handleBarcodeScanned} theme={theme} />

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

// ─── DateNavBar ───────────────────────────────────────────────────────────────

function DateNavBar({ date, onChange, theme }: { date: string; onChange: (d: string) => void; theme: any }) {
	const isToday = date === todayISO();

	function shift(days: number) {
		const d = new Date(date);
		d.setDate(d.getDate() + days);
		onChange(d.toISOString().split("T")[0]);
	}

	const label = isToday
		? "Today"
		: new Date(date + "T00:00:00").toLocaleDateString(undefined, {
				weekday: "short",
				month: "short",
				day: "numeric",
			});

	return (
		<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 }}>
			{/* Go back — always enabled */}
			<TouchableOpacity onPress={() => shift(-1)}>
				<FontAwesome5 name="chevron-left" size={14} color={theme.primary} />
			</TouchableOpacity>

			<TouchableOpacity onPress={() => onChange(todayISO())}>
				<Text style={{ fontSize: 15, fontWeight: "700", color: theme.text }}>{label}</Text>
				{!isToday && <Text style={{ fontSize: 11, color: theme.primary, textAlign: "center" }}>Tap to return to today</Text>}
			</TouchableOpacity>

			{/* Go forward — always enabled */}
			<TouchableOpacity onPress={() => shift(1)}>
				<FontAwesome5 name="chevron-right" size={14} color={theme.primary} />
			</TouchableOpacity>
		</View>
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
	const [selectedDate, setSelectedDate] = useState(todayISO());

	const goals = { calories: 2500, protein: 180, carbs: 250, fat: 75 };

	async function fetchEntries() {
		try {
			const res = await instance.get(`/nutrition/diary?start_date=${selectedDate}&end_date=${selectedDate}`);
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
	}, [selectedDate]);

	const sections = useMemo(() => groupByMeal(entries), [entries]);
	const dayTotals = useMemo(() => sumNutrients(entries), [entries]);
	const remaining = goals.calories - Math.round(dayTotals.calories);

	function openLogModal(mealType?: string) {
		if (mealType) setActiveMealType(mealType);
		setLogModalVisible(true);
	}

	const styles = useMemo(
		() =>
			StyleSheet.create({
				safe: { flex: 1, backgroundColor: theme.background },
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
				heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
				remainLabel: { fontSize: 11, fontWeight: "700", color: theme.textMuted, letterSpacing: 1.5, textTransform: "uppercase" },
				remainNumber: { fontSize: 44, fontWeight: "800", color: remaining >= 0 ? theme.text : theme.error, lineHeight: 48 },
				goalText: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
				goalEaten: { fontSize: 13, color: theme.textMuted },
				macroRow: { flexDirection: "row", gap: 12 },
				pageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
				pageTitle: { fontSize: 22, fontWeight: "800", color: theme.text },
				addBtn: {
					flexDirection: "row",
					alignItems: "center",
					gap: 6,
					backgroundColor: theme.primary,
					paddingHorizontal: 14,
					paddingVertical: 8,
					borderRadius: 10,
				},
				addBtnText: { fontSize: 12, fontWeight: "700", color: theme.textInverse, textTransform: "uppercase", letterSpacing: 0.5 },
				sectionHeader: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					backgroundColor: theme.background,
					paddingHorizontal: 16,
					paddingTop: 16,
					paddingBottom: 8,
				},
				sectionLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
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
				sectionTitle: { fontSize: 15, fontWeight: "700", color: theme.text },
				sectionMeta: { fontSize: 12, color: theme.textMuted, marginTop: 1 },
				sectionAddBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: theme.primary, alignItems: "center", justifyContent: "center" },
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
				entryName: { fontSize: 15, fontWeight: "600", color: theme.text, flex: 1 },
				entryMeta: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
				entryCalories: { fontSize: 15, fontWeight: "700", color: theme.text, marginLeft: 12 },
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
				emptyMealText: { fontSize: 13, color: theme.textTertiary },
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
						<View style={styles.pageHeader}>
							<Text style={styles.pageTitle}>Nutrition</Text>
							<TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={() => openLogModal()}>
								<FontAwesome5 name="search" size={11} color={theme.textInverse} />
								<Text style={styles.addBtnText}>Find Food</Text>
							</TouchableOpacity>
						</View>

						<DateNavBar date={selectedDate} onChange={setSelectedDate} theme={theme} />

						<View style={styles.heroCard}>
							<View style={styles.heroTop}>
								<View>
									<Text style={styles.remainLabel}>Remaining</Text>
									<Text style={styles.remainNumber}>{remaining.toLocaleString()}</Text>
									<Text style={styles.goalText}>Goal: {goals.calories.toLocaleString()} kcal</Text>
								</View>
								<Text style={styles.goalEaten}>{Math.round(dayTotals.calories).toLocaleString()} eaten</Text>
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
									{section.totals.calories > 0 ? (
										<>
											<Text style={{ color: theme.text }}>{Math.round(section.totals.calories)} kcal</Text>
											<Text style={{ color: theme.textSecondary }}> · </Text>
											<Text style={{ color: "#4ADE80" }}>P: {Math.round(section.totals.protein)}g</Text>
											<Text style={{ color: theme.textSecondary }}> · </Text>
											<Text style={{ color: "#38BDF8" }}>C: {Math.round(section.totals.carbs)}g</Text>
											<Text style={{ color: theme.textSecondary }}> · </Text>
											<Text style={{ color: "#FB923C" }}>F: {Math.round(section.totals.fat)}g</Text>
										</>
									) : (
										"No entries yet"
									)}
								</Text>
							</View>
						</View>
						<TouchableOpacity style={styles.sectionAddBtn} activeOpacity={0.7} onPress={() => openLogModal(section.meal_type)}>
							<FontAwesome5 name="plus" size={12} color={theme.primary} />
						</TouchableOpacity>
					</View>
				)}
				renderItem={({ item }) => {
					const macros = extractMacros(item.nutrients);
					return (
						<TouchableOpacity style={styles.entryCard} onPress={() => setEditEntry(item)}>
							<View style={{ flex: 1 }}>
								<Text style={styles.entryName}>{item.food?.name ?? item.recipe?.name ?? "Unknown"}</Text>
								<Text style={styles.entryMeta}>
									{item.quantity} {item.unit}
									{item.food?.brand ? ` · ${item.food.brand}` : ""}
								</Text>
							</View>
							<Text style={styles.entryCalories}>{Math.round(macros.calories)}</Text>
						</TouchableOpacity>
					);
				}}
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
				logDate={selectedDate}
				onClose={() => setLogModalVisible(false)}
				onLogged={() => {
					setLogModalVisible(false);
					fetchEntries();
				}}
				theme={theme}
			/>
			<EditEntryModal
				visible={editEntry !== null}
				entry={editEntry}
				onClose={() => setEditEntry(null)}
				onUpdated={() => {
					setEditEntry(null);
					fetchEntries();
				}}
				theme={theme}
			/>
		</SafeAreaView>
	);
}
