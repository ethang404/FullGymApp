import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	Modal,
	TextInput,
	KeyboardAvoidingView,
	Platform,
	ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useContext, useMemo, useState, useEffect } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import Pills from "@/components/Pills";
import { themes, themeLabels, type ThemeName } from "@/theme/colors";
import { AuthContext } from "@/utils/AuthProvider";
import { useProfile, type EstimateBody } from "@/utils/ProfileProvider";
import {
	MACRO_KEYS,
	MACRO_META,
	SEXES,
	ACTIVITY_LEVELS,
	ACTIVITY_LABELS,
	GOAL_TYPES,
	GOAL_TYPE_LABELS,
	type MacroKey,
	type Sex,
	type ActivityLevel,
	type GoalType,
} from "@/utils/macroDefaults";

// ─── Theme options ─────────────────────────────────────────────────────────────

const THEME_OPTIONS: { name: ThemeName; label: string; primary: string; bg: string }[] = (
	Object.keys(themes) as ThemeName[]
).map((name) => ({
	name,
	label: themeLabels[name],
	primary: themes[name].primary,
	bg: themes[name].background,
}));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function Profile() {
	const { theme, name: activeName, setTheme } = useTheme();
	const { signOut } = useContext(AuthContext);
	const { profile, goals, updateProfile, estimateGoals } = useProfile();

	const [goalsModalOpen, setGoalsModalOpen] = useState(false);
	const [bodyModalOpen, setBodyModalOpen] = useState(false);

	const displayName =
		[profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.user_name || "Your Name";
	const memberSince = profile?.created_at ? new Date(profile.created_at).getFullYear() : null;

	const styles = useMemo(
		() =>
			StyleSheet.create({
				safe: { flex: 1, backgroundColor: theme.background },
				scroll: { flex: 1 },
				content: { paddingBottom: 40 },

				pageHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
				pageTitle: { fontSize: 22, fontWeight: "800", color: theme.text },

				avatarSection: { alignItems: "center", paddingVertical: 24, gap: 10 },
				avatar: {
					width: 72,
					height: 72,
					borderRadius: 36,
					backgroundColor: theme.cardBgAlt,
					alignItems: "center",
					justifyContent: "center",
					borderWidth: 2,
					borderColor: theme.primary,
				},
				userName: { fontSize: 20, fontWeight: "800", color: theme.text },
				userSub: { fontSize: 13, color: theme.textMuted },

				sectionLabel: {
					fontSize: 11,
					fontWeight: "700",
					color: theme.textMuted,
					letterSpacing: 1.5,
					textTransform: "uppercase",
					paddingHorizontal: 20,
					marginBottom: 8,
					marginTop: 24,
				},

				group: {
					marginHorizontal: 16,
					backgroundColor: theme.cardBg,
					borderRadius: 16,
					borderWidth: 1,
					borderColor: theme.border,
					overflow: "hidden",
				},
				row: {
					flexDirection: "row",
					alignItems: "center",
					paddingHorizontal: 16,
					paddingVertical: 14,
					borderBottomWidth: 1,
					borderBottomColor: theme.border,
					gap: 14,
				},
				rowLast: { borderBottomWidth: 0 },
				rowIcon: {
					width: 32,
					height: 32,
					borderRadius: 9,
					backgroundColor: theme.cardBgAlt,
					alignItems: "center",
					justifyContent: "center",
				},
				rowLabel: { fontSize: 15, fontWeight: "600", color: theme.text, flex: 1 },
				rowValue: { fontSize: 14, color: theme.textMuted, marginRight: 6 },
				rowValueMuted: { fontSize: 12, color: theme.textTertiary, marginRight: 6 },

				themeGrid: { marginHorizontal: 16, flexDirection: "row", flexWrap: "wrap", gap: 10 },
				themePill: {
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
					paddingHorizontal: 14,
					paddingVertical: 10,
					borderRadius: 12,
					borderWidth: 1.5,
				},
				themeSwatch: { width: 16, height: 16, borderRadius: 8 },
				themePillText: { fontSize: 13, fontWeight: "600" },

				dangerRow: {
					marginHorizontal: 16,
					marginTop: 12,
					borderRadius: 14,
					borderWidth: 1,
					borderColor: `${theme.error}40`,
					backgroundColor: `${theme.error}10`,
					paddingHorizontal: 16,
					paddingVertical: 14,
					flexDirection: "row",
					alignItems: "center",
					gap: 12,
				},
				dangerText: { fontSize: 15, fontWeight: "600", color: theme.error, flex: 1 },
			}),
		[theme],
	);

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				<View style={styles.pageHeader}>
					<Text style={styles.pageTitle}>Profile</Text>
				</View>

				<View style={styles.avatarSection}>
					<View style={styles.avatar}>
						<FontAwesome5 name="user" size={28} color={theme.primary} />
					</View>
					<Text style={styles.userName}>{displayName}</Text>
					{memberSince && <Text style={styles.userSub}>Member since {memberSince}</Text>}
				</View>

				{/* Nutrition goals */}
				<Text style={styles.sectionLabel}>Nutrition Goals</Text>
				<View style={styles.group}>
					{MACRO_KEYS.map((k, i) => {
						const stored = profile?.goals?.[k] ?? null;
						return (
							<TouchableOpacity
								key={k}
								style={[styles.row, i === MACRO_KEYS.length - 1 && styles.rowLast]}
								onPress={() => setGoalsModalOpen(true)}
								activeOpacity={0.7}
							>
								<View style={styles.rowIcon}>
									<FontAwesome5 name="bullseye" size={13} color={theme.textSecondary} />
								</View>
								<Text style={styles.rowLabel}>{MACRO_META[k].label}</Text>
								{stored == null && <Text style={styles.rowValueMuted}>default</Text>}
								<Text style={styles.rowValue}>
									{goals[k]} {MACRO_META[k].unit}
								</Text>
								<FontAwesome5 name="chevron-right" size={12} color={theme.textTertiary} />
							</TouchableOpacity>
						);
					})}
				</View>

				<Text style={styles.sectionLabel}>Body &amp; Calculator</Text>
				<View style={styles.group}>
					<TouchableOpacity style={[styles.row, styles.rowLast]} onPress={() => setBodyModalOpen(true)} activeOpacity={0.7}>
						<View style={styles.rowIcon}>
							<FontAwesome5 name="calculator" size={13} color={theme.textSecondary} />
						</View>
						<Text style={styles.rowLabel}>Body metrics &amp; TDEE</Text>
						<Text style={styles.rowValue}>
							{profile?.body?.weight_kg ? `${Math.round(Number(profile.body.weight_kg))} kg` : "Set up"}
						</Text>
						<FontAwesome5 name="chevron-right" size={12} color={theme.textTertiary} />
					</TouchableOpacity>
				</View>

				{/* Theme */}
				<Text style={styles.sectionLabel}>Theme</Text>
				<View style={styles.themeGrid}>
					{THEME_OPTIONS.map((t) => {
						const isActive = activeName === t.name;
						return (
							<TouchableOpacity
								key={t.name}
								style={[
									styles.themePill,
									{
										backgroundColor: isActive ? `${t.primary}20` : theme.cardBg,
										borderColor: isActive ? t.primary : theme.border,
									},
								]}
								onPress={() => setTheme(t.name)}
								activeOpacity={0.7}
							>
								<View style={[styles.themeSwatch, { backgroundColor: t.primary, borderWidth: 1, borderColor: `${t.primary}60` }]} />
								<Text style={[styles.themePillText, { color: isActive ? t.primary : theme.textSecondary }]}>{t.label}</Text>
								{isActive && <FontAwesome5 name="check" size={10} color={t.primary} />}
							</TouchableOpacity>
						);
					})}
				</View>

				{/* Account */}
				<Text style={styles.sectionLabel}>Account</Text>
				<View style={styles.group}>
					<View style={styles.row}>
						<View style={styles.rowIcon}>
							<FontAwesome5 name="bell" size={13} color={theme.textSecondary} />
						</View>
						<Text style={styles.rowLabel}>Notifications</Text>
						<FontAwesome5 name="chevron-right" size={12} color={theme.textTertiary} />
					</View>
					<View style={styles.row}>
						<View style={styles.rowIcon}>
							<FontAwesome5 name="shield-alt" size={13} color={theme.textSecondary} />
						</View>
						<Text style={styles.rowLabel}>Privacy Policy</Text>
						<FontAwesome5 name="external-link-alt" size={11} color={theme.textTertiary} />
					</View>
					<TouchableOpacity style={[styles.row, styles.rowLast]} onPress={signOut} activeOpacity={0.7}>
						<View style={styles.rowIcon}>
							<FontAwesome5 name="sign-out-alt" size={13} color={theme.textSecondary} />
						</View>
						<Text style={styles.rowLabel}>Log Out</Text>
					</TouchableOpacity>
				</View>

				{/* Danger */}
				<Text style={styles.sectionLabel}>Danger Zone</Text>
				<TouchableOpacity style={styles.dangerRow} activeOpacity={0.7}>
					<FontAwesome5 name="trash-alt" size={15} color={theme.error} />
					<Text style={styles.dangerText}>Delete Account</Text>
					<FontAwesome5 name="chevron-right" size={12} color={theme.error} />
				</TouchableOpacity>
			</ScrollView>

			<GoalsModal
				visible={goalsModalOpen}
				onClose={() => setGoalsModalOpen(false)}
				initial={Object.fromEntries(MACRO_KEYS.map((k) => [k, String(goals[k])])) as Record<MacroKey, string>}
				onSave={async (parsed) => {
					await updateProfile({ goals: parsed });
					setGoalsModalOpen(false);
				}}
			/>

			<BodyModal
				visible={bodyModalOpen}
				onClose={() => setBodyModalOpen(false)}
				initialBody={profile?.body ?? null}
				initialGoals={Object.fromEntries(MACRO_KEYS.map((k) => [k, String(goals[k])])) as Record<MacroKey, string>}
				estimateGoals={estimateGoals}
				onSave={async (patch) => {
					await updateProfile(patch);
					setBodyModalOpen(false);
				}}
			/>
		</SafeAreaView>
	);
}

// ─── Goals edit modal ─────────────────────────────────────────────────────────

function GoalsModal({
	visible,
	onClose,
	initial,
	onSave,
}: {
	visible: boolean;
	onClose: () => void;
	initial: Record<MacroKey, string>;
	onSave: (parsed: Partial<Record<MacroKey, number>>) => Promise<void>;
}) {
	const { theme } = useTheme();
	const [values, setValues] = useState<Record<MacroKey, string>>(initial);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (visible) {
			setValues(initial);
			setError(null);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [visible]);

	async function handleSave() {
		const parsed: Partial<Record<MacroKey, number>> = {};
		for (const k of MACRO_KEYS) {
			const n = parseInt(values[k], 10);
			if (!Number.isFinite(n) || n <= 0) {
				setError(`Enter a valid ${MACRO_META[k].label.toLowerCase()} goal.`);
				return;
			}
			parsed[k] = n;
		}
		setSaving(true);
		setError(null);
		try {
			await onSave(parsed);
		} catch {
			setError("Could not save. Try again.");
		} finally {
			setSaving(false);
		}
	}

	const s = modalStyles(theme, saving);

	return (
		<Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
			<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.overlay}>
				<View style={s.sheet}>
					<View style={s.headerRow}>
						<Text style={s.title}>Edit nutrition goals</Text>
						<TouchableOpacity onPress={onClose} hitSlop={10}>
							<FontAwesome5 name="times" size={20} color={theme.primary} />
						</TouchableOpacity>
					</View>

					{MACRO_KEYS.map((k) => (
						<View key={k} style={s.fieldRow}>
							<Text style={s.fieldLabel}>{MACRO_META[k].label}</Text>
							<TextInput
								style={s.fieldInput}
								value={values[k]}
								onChangeText={(t) => setValues((v) => ({ ...v, [k]: t.replace(/[^0-9]/g, "") }))}
								keyboardType="number-pad"
							/>
							<Text style={s.fieldUnit}>{MACRO_META[k].unit}</Text>
						</View>
					))}

					{error && <Text style={s.errorText}>{error}</Text>}

					<TouchableOpacity style={s.saveButton} onPress={handleSave} disabled={saving}>
						{saving ? <ActivityIndicator color={theme.textInverse} /> : <Text style={s.saveButtonText}>Save</Text>}
					</TouchableOpacity>
					<TouchableOpacity style={s.cancelButton} onPress={onClose}>
						<Text style={s.cancelButtonText}>Cancel</Text>
					</TouchableOpacity>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}

// ─── Body metrics + calculator modal ──────────────────────────────────────────

function BodyModal({
	visible,
	onClose,
	initialBody,
	initialGoals,
	estimateGoals,
	onSave,
}: {
	visible: boolean;
	onClose: () => void;
	initialBody: {
		sex: Sex | null;
		birth_date: string | null;
		height_cm: number | string | null;
		weight_kg: number | string | null;
		activity_level: ActivityLevel | null;
		goal_type: GoalType | null;
	} | null;
	initialGoals: Record<MacroKey, string>;
	estimateGoals: (body: EstimateBody) => Promise<{ goals: Record<MacroKey, number> }>;
	onSave: (patch: any) => Promise<void>;
}) {
	const { theme } = useTheme();

	const [sex, setSex] = useState<Sex | null>(null);
	const [birthDate, setBirthDate] = useState("");
	const [heightCm, setHeightCm] = useState("");
	const [weightKg, setWeightKg] = useState("");
	const [activity, setActivity] = useState<ActivityLevel | null>(null);
	const [goalType, setGoalType] = useState<GoalType | null>(null);
	const [goalVals, setGoalVals] = useState<Record<MacroKey, string>>(initialGoals);

	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!visible) return;
		setSex(initialBody?.sex ?? null);
		setBirthDate(initialBody?.birth_date ?? "");
		setHeightCm(initialBody?.height_cm != null ? String(Math.round(Number(initialBody.height_cm) * 10) / 10) : "");
		setWeightKg(initialBody?.weight_kg != null ? String(Math.round(Number(initialBody.weight_kg) * 10) / 10) : "");
		setActivity(initialBody?.activity_level ?? null);
		setGoalType(initialBody?.goal_type ?? null);
		setGoalVals(initialGoals);
		setError(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [visible]);

	function buildBody(): EstimateBody | null {
		if (!sex || !DATE_RE.test(birthDate) || !activity || !goalType) return null;
		const h = parseFloat(heightCm);
		const w = parseFloat(weightKg);
		if (!h || h <= 0 || !w || w <= 0) return null;
		return { sex, birth_date: birthDate, height_cm: h, weight_kg: w, activity_level: activity, goal_type: goalType };
	}

	async function handleRecalc() {
		const body = buildBody();
		if (!body) {
			setError("Fill in every field first. Birth date must be YYYY-MM-DD.");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const est = await estimateGoals(body);
			setGoalVals(Object.fromEntries(MACRO_KEYS.map((k) => [k, String(est.goals[k])])) as Record<MacroKey, string>);
		} catch {
			setError("Could not calculate an estimate.");
		} finally {
			setBusy(false);
		}
	}

	async function handleSave() {
		const parsedGoals: Partial<Record<MacroKey, number>> = {};
		for (const k of MACRO_KEYS) {
			const n = parseInt(goalVals[k], 10);
			if (!Number.isFinite(n) || n <= 0) {
				setError(`Enter a valid ${MACRO_META[k].label.toLowerCase()} goal.`);
				return;
			}
			parsedGoals[k] = n;
		}
		const body = buildBody();
		setBusy(true);
		setError(null);
		try {
			await onSave({ ...(body ?? {}), goals: parsedGoals });
		} catch {
			setError("Could not save. Try again.");
			setBusy(false);
		}
	}

	const s = modalStyles(theme, busy);

	return (
		<Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
			<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.overlay}>
				<ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
					<View style={s.sheet}>
						<View style={s.headerRow}>
							<Text style={s.title}>Body metrics &amp; calculator</Text>
							<TouchableOpacity onPress={onClose} hitSlop={10}>
								<FontAwesome5 name="times" size={20} color={theme.primary} />
							</TouchableOpacity>
						</View>

						<Text style={s.sectionLabel}>SEX</Text>
						<Pills options={SEXES} value={sex} onSelect={setSex} labels={{ male: "Male", female: "Female" }} />

						<Text style={s.sectionLabel}>DATE OF BIRTH</Text>
						<TextInput
							style={s.textInput}
							placeholder="YYYY-MM-DD"
							placeholderTextColor={theme.inputPlaceholder}
							value={birthDate}
							onChangeText={setBirthDate}
							autoCapitalize="none"
						/>

						<View style={s.row}>
							<View style={s.grow}>
								<Text style={s.sectionLabel}>HEIGHT (CM)</Text>
								<TextInput style={s.textInput} placeholder="175" placeholderTextColor={theme.inputPlaceholder} value={heightCm} onChangeText={setHeightCm} keyboardType="decimal-pad" />
							</View>
							<View style={s.grow}>
								<Text style={s.sectionLabel}>WEIGHT (KG)</Text>
								<TextInput style={s.textInput} placeholder="70" placeholderTextColor={theme.inputPlaceholder} value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" />
							</View>
						</View>

						<Text style={s.sectionLabel}>ACTIVITY LEVEL</Text>
						<Pills options={ACTIVITY_LEVELS} value={activity} onSelect={setActivity} labels={ACTIVITY_LABELS} />

						<Text style={s.sectionLabel}>GOAL</Text>
						<Pills options={GOAL_TYPES} value={goalType} onSelect={setGoalType} labels={GOAL_TYPE_LABELS} />

						<TouchableOpacity style={s.secondaryButton} onPress={handleRecalc} disabled={busy}>
							<FontAwesome5 name="calculator" size={13} color={theme.primary} />
							<Text style={s.secondaryButtonText}>Recalculate goals from metrics</Text>
						</TouchableOpacity>

						<Text style={s.sectionLabel}>GOALS</Text>
						{MACRO_KEYS.map((k) => (
							<View key={k} style={s.fieldRow}>
								<Text style={s.fieldLabel}>{MACRO_META[k].label}</Text>
								<TextInput
									style={s.fieldInput}
									value={goalVals[k]}
									onChangeText={(t) => setGoalVals((v) => ({ ...v, [k]: t.replace(/[^0-9]/g, "") }))}
									keyboardType="number-pad"
								/>
								<Text style={s.fieldUnit}>{MACRO_META[k].unit}</Text>
							</View>
						))}

						{error && <Text style={s.errorText}>{error}</Text>}

						<TouchableOpacity style={s.saveButton} onPress={handleSave} disabled={busy}>
							{busy ? <ActivityIndicator color={theme.textInverse} /> : <Text style={s.saveButtonText}>Save</Text>}
						</TouchableOpacity>
						<TouchableOpacity style={s.cancelButton} onPress={onClose}>
							<Text style={s.cancelButtonText}>Cancel</Text>
						</TouchableOpacity>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</Modal>
	);
}

function modalStyles(theme: any, busy: boolean) {
	return StyleSheet.create({
		overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: theme.overlay },
		sheet: {
			backgroundColor: theme.cardBg,
			borderTopLeftRadius: 20,
			borderTopRightRadius: 20,
			padding: 20,
			paddingBottom: 32,
			gap: 4,
		},
		headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
		title: { color: theme.text, fontSize: 17, fontWeight: "700", flex: 1 },
		sectionLabel: { color: theme.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
		row: { flexDirection: "row", gap: 12 },
		grow: { flex: 1 },
		textInput: {
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: theme.inputBorder,
			backgroundColor: theme.inputBg,
			borderRadius: 12,
			paddingHorizontal: 14,
			paddingVertical: 12,
			color: theme.text,
			fontSize: 16,
		},
		fieldRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
		fieldLabel: { flex: 1, color: theme.text, fontSize: 15, fontWeight: "600" },
		fieldInput: {
			width: 110,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: theme.inputBorder,
			backgroundColor: theme.inputBg,
			borderRadius: 10,
			paddingHorizontal: 12,
			paddingVertical: 10,
			color: theme.text,
			fontSize: 16,
			textAlign: "right",
		},
		fieldUnit: { width: 34, color: theme.textMuted, fontSize: 12 },
		errorText: { color: theme.error, fontSize: 12, marginTop: 12 },
		secondaryButton: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: 8,
			borderWidth: 1.5,
			borderColor: theme.primary,
			borderRadius: 12,
			paddingVertical: 12,
			marginTop: 16,
		},
		secondaryButtonText: { color: theme.primary, fontSize: 14, fontWeight: "700" },
		saveButton: {
			backgroundColor: theme.primary,
			borderRadius: 14,
			paddingVertical: 14,
			alignItems: "center",
			marginTop: 18,
			marginBottom: 10,
			opacity: busy ? 0.6 : 1,
		},
		saveButtonText: { color: theme.textInverse, fontSize: 15, fontWeight: "700" },
		cancelButton: { alignItems: "center", paddingVertical: 10 },
		cancelButtonText: { color: theme.textMuted, fontSize: 14, fontWeight: "600" },
	});
}
