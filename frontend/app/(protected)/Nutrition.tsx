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
  serving_sizes: { label: string; weight_g: number }[];
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

// ─── Constants ────────────────────────────────────────────────────────────────

const NUTRIENTS = [
	{ nutrient_id: 1008, nutrient_name: "Energy", unit: "kcal", label: "Calories", color: null },
	{ nutrient_id: 1003, nutrient_name: "Protein", unit: "g", label: "Protein", color: "#4ADE80" },
	{ nutrient_id: 1005, nutrient_name: "Carbohydrate, by difference", unit: "g", label: "Carbs", color: "#38BDF8" },
	{ nutrient_id: 1004, nutrient_name: "Total lipid (fat)", unit: "g", label: "Fat", color: "#FB923C" },
];

const SERVING_PRESETS = [
	{ label: "g", autoGrams: true },
	{ label: "oz", autoGrams: false },
	{ label: "cup", autoGrams: false },
	{ label: "tbsp", autoGrams: false },
	{ label: "tsp", autoGrams: false },
	{ label: "piece", autoGrams: false },
	{ label: "slice", autoGrams: false },
	{ label: "scoop", autoGrams: false },
	{ label: "serving", autoGrams: false },
	{ label: "handful", autoGrams: false },
	{ label: "packet", autoGrams: false },
];

const MAX_SERVINGS = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServingRow {
	id: number;
	label: string;
	quantity: string;
	weight_g: string; // grams for this serving — ignored when label === "g"
}

interface NutrientRow {
	nutrient_id: number;
	nutrient_name: string;
	unit: string;
	label: string;
	color: string | null;
	amount: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function resolveGrams(row: ServingRow): number {
	if (row.label === "g") return parseFloat(row.quantity) || 0;
	return parseFloat(row.weight_g) || 0;
}

// ─── Preset picker ────────────────────────────────────────────────────────────

function PresetPicker({
	value,
	onSelect,
	usedLabels,
	theme,
}: {
	value: string;
	onSelect: (label: string) => void;
	usedLabels: string[];
	theme: any;
}) {
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
				<Pressable
					style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 40 }}
					onPress={() => setOpen(false)}
				>
					<Pressable onPress={(e) => e.stopPropagation()}>
						<View
							style={{
								backgroundColor: theme.cardBg,
								borderRadius: 16,
								borderWidth: 1,
								borderColor: theme.border,
								overflow: "hidden",
							}}
						>
							<View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: theme.border }}>
								<Text style={{ fontSize: 13, fontWeight: "700", color: theme.textMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>
									Select unit
								</Text>
							</View>
							{SERVING_PRESETS.map((p, i) => {
								const isUsed = usedLabels.includes(p.label) && p.label !== value;
								return (
									<TouchableOpacity
										key={p.label}
										onPress={() => {
											if (!isUsed) {
												onSelect(p.label);
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
										<Text
											style={{
												fontSize: 15,
												color: p.label === value ? theme.primary : theme.text,
												fontWeight: p.label === value ? "700" : "400",
											}}
										>
											{p.label}
										</Text>
										{p.label === value && <FontAwesome5 name="check" size={12} color={theme.primary} />}
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

// ─── Main modal ───────────────────────────────────────────────────────────────

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
	const [name, setName] = useState(prefillName);
	const [brand, setBrand] = useState("");
	const [referenceId, setReferenceId] = useState(1);
	const [servings, setServings] = useState<ServingRow[]>([
		{ id: 1, label: "g", quantity: "100", weight_g: "" },
	]);
	const [nextId, setNextId] = useState(2);
	const [nutrients, setNutrients] = useState<NutrientRow[]>(
		NUTRIENTS.map((n) => ({ ...n, amount: "" }))
	);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!visible) return;
		setName(prefillName);
		setBrand("");
		setReferenceId(1);
		setServings([{ id: 1, label: "g", quantity: "100", weight_g: "" }]);
		setNextId(2);
		setNutrients(NUTRIENTS.map((n) => ({ ...n, amount: "" })));
		setErrors({});
	}, [visible, prefillName]);

	function addServing() {
		if (servings.length >= MAX_SERVINGS) return;
		const usedLabels = servings.map((s) => s.label);
		const next = SERVING_PRESETS.find((p) => !usedLabels.includes(p.label));
		setServings((prev) => [
			...prev,
			{ id: nextId, label: next?.label ?? "cup", quantity: "1", weight_g: "" },
		]);
		setNextId((n) => n + 1);
	}

	function updateServing(id: number, field: keyof ServingRow, value: string) {
		setServings((prev) =>
			prev.map((s) => {
				if (s.id !== id) return s;
				const updated = { ...s, [field]: value };
				if (field === "label" && value === "g") updated.weight_g = "";
				return updated;
			})
		);
	}

	function removeServing(id: number) {
		setServings((prev) => prev.filter((s) => s.id !== id));
		if (referenceId === id) {
			const remaining = servings.filter((s) => s.id !== id);
			setReferenceId(remaining[0]?.id ?? -1);
		}
	}

	function updateNutrient(nutrient_id: number, amount: string) {
		setNutrients((prev) =>
			prev.map((n) => (n.nutrient_id === nutrient_id ? { ...n, amount } : n))
		);
	}

	const usedLabels = servings.map((s) => s.label);
	const referenceRow = servings.find((s) => s.id === referenceId) ?? servings[0];

	function validate(): Record<string, string> {
		const e: Record<string, string> = {};
		if (!name.trim()) e.name = "Required";

		const calRow = nutrients.find((n) => n.nutrient_id === 1008);
		if (!calRow?.amount.trim() || isNaN(Number(calRow.amount))) e.calories = "Required";

		servings.forEach((s) => {
			const qty = parseFloat(s.quantity);
			if (!s.quantity || isNaN(qty) || qty <= 0) e[`qty_${s.id}`] = "Required";
			if (s.label !== "g") {
				const w = parseFloat(s.weight_g);
				if (!s.weight_g || isNaN(w) || w <= 0) e[`wt_${s.id}`] = "Enter gram weight";
			}
		});

		return e;
	}

	async function handleSave() {
		const e = validate();
		if (Object.keys(e).length > 0) { setErrors(e); return; }
		setSaving(true);
		try {
			const serving_sizes = servings.map((s) => ({
				label: s.label,
				weight_g: resolveGrams(s),
			}));

			const ref = referenceRow;
			const serving = {
				quantity: parseFloat(ref.quantity),
				unit: ref.label,
			};

			const payload = {
				name: name.trim(),
				brand: brand.trim() || undefined,
				nutrients: nutrients
					.filter((n) => n.amount.trim() !== "" && !isNaN(Number(n.amount)))
					.map((n) => ({
						nutrient_id: n.nutrient_id,
						nutrient_name: n.nutrient_name,
						unit: n.unit,
						amount: Number(n.amount),
					})),
				serving_sizes,
				serving,
			};

			const res = await instance.post("/nutrition/foods", payload);
			onSaved(res.data.food);
		} catch (err) {
			console.error("Add food error:", err);
		} finally {
			setSaving(false);
		}
	}

	const s = {
		input: {
			backgroundColor: theme.cardBgAlt,
			borderRadius: 10,
			borderWidth: 1,
			borderColor: theme.border,
			paddingHorizontal: 14,
			paddingVertical: 11,
			fontSize: 15,
			color: theme.text,
		} as const,
		err: { borderColor: theme.error } as const,
		label: {
			fontSize: 11,
			fontWeight: "700" as const,
			color: theme.textMuted,
			letterSpacing: 0.8,
			textTransform: "uppercase" as const,
			marginBottom: 6,
		},
		sectionTitle: {
			fontSize: 14,
			fontWeight: "700" as const,
			color: theme.text,
			marginBottom: 2,
		},
		errorText: { fontSize: 11, color: theme.error, marginTop: 3 },
		divider: { height: 1, backgroundColor: theme.border, marginVertical: 16 },
	};

	return (
		<Modal visible={visible} transparent animationType="slide">
			<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
				<Pressable
					style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}
					onPress={onClose}
				>
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
							<View
								style={{
									width: 36,
									height: 4,
									backgroundColor: theme.border,
									borderRadius: 2,
									alignSelf: "center",
									marginTop: 12,
									marginBottom: 8,
								}}
							/>

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
								<TouchableOpacity
									onPress={onClose}
									style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
								>
									<FontAwesome5 name="arrow-left" size={12} color={theme.primary} />
									<Text style={{ fontSize: 13, color: theme.primary }}>Back</Text>
								</TouchableOpacity>
								<Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>Add new food</Text>
								<View style={{ width: 60 }} />
							</View>

							<ScrollView
								keyboardShouldPersistTaps="handled"
								contentContainerStyle={{ padding: 16, gap: 12 }}
								showsVerticalScrollIndicator={false}
							>
								{/* ── Basic info ───────────────────────────────── */}
								<Text style={s.sectionTitle}>Basic info</Text>

								<View style={{ gap: 4 }}>
									<Text style={s.label}>Food name *</Text>
									<TextInput
										style={[s.input, errors.name && s.err]}
										value={name}
										onChangeText={setName}
										placeholder="e.g. Oat milk, Brown rice"
										placeholderTextColor={theme.textTertiary}
									/>
									{errors.name && <Text style={s.errorText}>{errors.name}</Text>}
								</View>

								<View style={{ gap: 4 }}>
									<Text style={s.label}>Brand (optional)</Text>
									<TextInput
										style={s.input}
										value={brand}
										onChangeText={setBrand}
										placeholder="e.g. Quaker, Oatly"
										placeholderTextColor={theme.textTertiary}
									/>
								</View>

								<View style={s.divider} />

								{/* ── Serving sizes ────────────────────────────── */}
								<View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
									<View>
										<Text style={s.sectionTitle}>Serving sizes</Text>
										<Text style={{ fontSize: 12, color: theme.textMuted, marginBottom: 10 }}>
											Pick which serving your nutrition label uses, then add others.
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
									const hasQtyErr = !!errors[`qty_${row.id}`];
									const hasWtErr = !!errors[`wt_${row.id}`];

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
											{/* Radio + remove */}
											<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
												<TouchableOpacity
													onPress={() => setReferenceId(row.id)}
													style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
												>
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
														{isRef && (
															<View
																style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary }}
															/>
														)}
													</View>
													<Text
														style={{
															fontSize: 12,
															fontWeight: "600",
															color: isRef ? theme.primary : theme.textMuted,
														}}
													>
														{isRef ? "Macros entered for this serving" : "Set as macro reference"}
													</Text>
												</TouchableOpacity>

												{servings.length > 1 && (
													<TouchableOpacity
														onPress={() => removeServing(row.id)}
														hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
													>
														<FontAwesome5 name="times" size={12} color={theme.textMuted} />
													</TouchableOpacity>
												)}
											</View>

											{/* Inputs */}
											<View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
												<View style={{ gap: 4 }}>
													<Text style={s.label}>Unit</Text>
													<PresetPicker
														value={row.label}
														onSelect={(label) => updateServing(row.id, "label", label)}
														usedLabels={usedLabels}
														theme={theme}
													/>
												</View>

												<View style={{ width: 72, gap: 4 }}>
													<Text style={s.label}>Qty</Text>
													<TextInput
														style={[s.input, hasQtyErr && s.err]}
														value={row.quantity}
														onChangeText={(v) => updateServing(row.id, "quantity", v)}
														keyboardType="numeric"
														placeholder="1"
														placeholderTextColor={theme.textTertiary}
													/>
													{hasQtyErr && <Text style={s.errorText}>{errors[`qty_${row.id}`]}</Text>}
												</View>

												{!isGrams && (
													<View style={{ flex: 1, gap: 4 }}>
														<Text style={s.label}>= grams</Text>
														<TextInput
															style={[s.input, hasWtErr && s.err]}
															value={row.weight_g}
															onChangeText={(v) => updateServing(row.id, "weight_g", v)}
															keyboardType="numeric"
															placeholder="e.g. 240"
															placeholderTextColor={theme.textTertiary}
														/>
														{hasWtErr && <Text style={s.errorText}>{errors[`wt_${row.id}`]}</Text>}
													</View>
												)}
											</View>

											{/* Summary line */}
											<Text style={{ fontSize: 12, color: isRef ? theme.primary : theme.textMuted }}>
												{isGrams
													? `${row.quantity || "?"} g`
													: `${row.quantity || "?"} ${row.label}${row.weight_g ? ` = ${row.weight_g} g` : ""}`}
											</Text>
										</View>
									);
								})}

								<View style={s.divider} />

								{/* ── Macros ───────────────────────────────────── */}
								<View style={{ marginBottom: 4 }}>
									<Text style={s.sectionTitle}>
										Macros for{" "}
										<Text style={{ color: theme.primary }}>
											{referenceRow
												? referenceRow.label === "g"
													? `${referenceRow.quantity || "?"} g`
													: `${referenceRow.quantity || "?"} ${referenceRow.label}${referenceRow.weight_g ? ` (${referenceRow.weight_g} g)` : ""}`
												: "selected serving"}
										</Text>
									</Text>
									<Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
										Copy the values from the nutrition label for that serving.
									</Text>
								</View>

								{/* Calories */}
								{nutrients
									.filter((n) => n.nutrient_id === 1008)
									.map((n) => (
										<View key={n.nutrient_id} style={{ gap: 4 }}>
											<Text style={s.label}>Calories (kcal) *</Text>
											<TextInput
												style={[s.input, errors.calories && s.err]}
												value={n.amount}
												onChangeText={(v) => updateNutrient(n.nutrient_id, v)}
												placeholder="e.g. 150"
												placeholderTextColor={theme.textTertiary}
												keyboardType="numeric"
											/>
											{errors.calories && <Text style={s.errorText}>{errors.calories}</Text>}
										</View>
									))}

								{/* Protein / Carbs / Fat */}
								<View style={{ flexDirection: "row", gap: 10 }}>
									{nutrients
										.filter((n) => n.nutrient_id !== 1008)
										.map((n) => (
											<View key={n.nutrient_id} style={{ flex: 1, gap: 4 }}>
												<Text style={[s.label, { color: n.color ?? theme.textMuted }]}>
													{n.label} (g)
												</Text>
												<TextInput
													style={s.input}
													value={n.amount}
													onChangeText={(v) => updateNutrient(n.nutrient_id, v)}
													placeholder="0"
													placeholderTextColor={theme.textTertiary}
													keyboardType="numeric"
												/>
											</View>
										))}
								</View>

								<View style={{ height: 24 }} />
							</ScrollView>

							{/* Save */}
							<TouchableOpacity
								onPress={handleSave}
								disabled={saving}
								style={{
									marginHorizontal: 16,
									marginBottom: 16,
									backgroundColor: theme.primary,
									borderRadius: 12,
									paddingVertical: 14,
									alignItems: "center",
								}}
							>
								{saving ? (
									<ActivityIndicator color={theme.textInverse} />
								) : (
									<Text style={{ fontSize: 15, fontWeight: "700", color: theme.textInverse }}>
										Save to database
									</Text>
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
