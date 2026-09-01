import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { router } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import Pills from "@/components/Pills";
import { useProfile, type EstimateBody } from "@/utils/ProfileProvider";
import {
	SEXES,
	ACTIVITY_LEVELS,
	ACTIVITY_LABELS,
	GOAL_TYPES,
	GOAL_TYPE_LABELS,
	MACRO_KEYS,
	MACRO_META,
	GOAL_DEFAULTS,
	type Sex,
	type ActivityLevel,
	type GoalType,
	type MacroGoals,
} from "@/utils/macroDefaults";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function Onboarding() {
	const { theme } = useTheme();
	const { profile, loading, updateProfile, estimateGoals } = useProfile();

	const [step, setStep] = useState<1 | 2>(1);

	// Step 1 — body metrics
	const [sex, setSex] = useState<Sex | null>(null);
	const [birthDate, setBirthDate] = useState("");
	const [heightCm, setHeightCm] = useState("");
	const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
	const [weightVal, setWeightVal] = useState("");
	const [activity, setActivity] = useState<ActivityLevel | null>(null);
	const [goalType, setGoalType] = useState<GoalType | null>(null);

	// Step 2 — editable goals
	const [goals, setGoals] = useState<Record<string, string>>(
		Object.fromEntries(MACRO_KEYS.map((k) => [k, String(GOAL_DEFAULTS[k])])),
	);
	const [estimating, setEstimating] = useState(false);

	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	// Someone who already finished onboarding should never see this screen.
	useEffect(() => {
		if (!loading && profile?.onboarding_completed) {
			router.replace("/(protected)/Home");
		}
	}, [loading, profile?.onboarding_completed]);

	const weightKg = useMemo(() => {
		const n = parseFloat(weightVal);
		if (!n || n <= 0) return null;
		return weightUnit === "kg" ? n : n * 0.45359237;
	}, [weightVal, weightUnit]);

	function buildBody(): EstimateBody | null {
		if (!sex || !DATE_RE.test(birthDate) || !activity || !goalType) return null;
		const h = parseFloat(heightCm);
		if (!h || h <= 0 || !weightKg) return null;
		return {
			sex,
			birth_date: birthDate,
			height_cm: Math.round(h * 100) / 100,
			weight_kg: Math.round(weightKg * 100) / 100,
			activity_level: activity,
			goal_type: goalType,
		};
	}

	async function goToReview() {
		const body = buildBody();
		if (!body) {
			setError("Fill in every field to continue. Birth date must be YYYY-MM-DD.");
			return;
		}
		setError(null);
		setEstimating(true);
		try {
			const est = await estimateGoals(body);
			setGoals(Object.fromEntries(MACRO_KEYS.map((k) => [k, String(est.goals[k])])));
		} catch {
			// fall back to defaults already in state
			setError("Could not calculate an estimate — using default goals, adjust as needed.");
		} finally {
			setEstimating(false);
			setStep(2);
		}
	}

	async function handleSave() {
		const parsed: Partial<MacroGoals> = {};
		for (const k of MACRO_KEYS) {
			const n = parseInt(goals[k], 10);
			if (!Number.isFinite(n) || n <= 0) {
				setError(`Enter a valid ${MACRO_META[k].label.toLowerCase()} goal.`);
				return;
			}
			parsed[k] = n;
		}
		setSaving(true);
		setError(null);
		try {
			const body = buildBody();
			await updateProfile({
				...(body ?? {}),
				goals: parsed,
				onboarding_completed: true,
			});
			router.replace("/(protected)/Home");
		} catch {
			setError("Something went wrong saving your goals. Try again.");
			setSaving(false);
		}
	}

	async function handleSkip() {
		setSaving(true);
		try {
			await updateProfile({ onboarding_completed: true });
			router.replace("/(protected)/Home");
		} catch {
			setError("Something went wrong. Try again.");
			setSaving(false);
		}
	}

	const styles = useMemo(
		() =>
			StyleSheet.create({
				container: { flexGrow: 1, backgroundColor: theme.authBackground, padding: 20, paddingTop: 60 },
				title: { fontSize: 26, fontWeight: "800", color: theme.authText, marginBottom: 4 },
				subtitle: { fontSize: 14, color: theme.authTextMuted, marginBottom: 24 },
				label: { fontSize: 13, color: theme.authLabel, marginBottom: 6, marginTop: 14, fontWeight: "600" },
				input: {
					backgroundColor: theme.authInputBg,
					borderRadius: 12,
					paddingHorizontal: 12,
					paddingVertical: 12,
					color: theme.authInputText,
					borderWidth: 1,
					borderColor: theme.authInputBorder,
				},
				row: { flexDirection: "row", gap: 10, alignItems: "center" },
				grow: { flex: 1 },
				error: { color: theme.error, fontSize: 13, marginTop: 14 },
				primaryButton: {
					backgroundColor: theme.primary,
					borderRadius: 12,
					paddingVertical: 14,
					alignItems: "center",
					marginTop: 24,
				},
				primaryButtonText: { color: theme.textInverse, fontSize: 16, fontWeight: "700" },
				skip: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
				skipText: { color: theme.authTextMuted, fontSize: 13, fontWeight: "600" },
				goalRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
				goalLabel: { flex: 1, color: theme.authText, fontSize: 15, fontWeight: "600" },
				goalInput: {
					width: 110,
					backgroundColor: theme.authInputBg,
					borderRadius: 10,
					paddingHorizontal: 12,
					paddingVertical: 10,
					color: theme.authInputText,
					borderWidth: 1,
					borderColor: theme.authInputBorder,
					textAlign: "right",
				},
				unit: { width: 34, color: theme.authTextMuted, fontSize: 12 },
			}),
		[theme],
	);

	if (loading) {
		return (
			<View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.authBackground }}>
				<ActivityIndicator color={theme.primary} size="large" />
			</View>
		);
	}

	return (
		<KeyboardAwareScrollView contentContainerStyle={styles.container} enableOnAndroid extraScrollHeight={40} keyboardShouldPersistTaps="handled">
			{step === 1 ? (
				<>
					<Text style={styles.title}>Set your targets</Text>
					<Text style={styles.subtitle}>
						A few details let us estimate your daily calories and macros. You can change everything later in Profile.
					</Text>

					<Text style={styles.label}>Sex</Text>
					<Pills options={SEXES} value={sex} onSelect={setSex} labels={{ male: "Male", female: "Female" }} />

					<Text style={styles.label}>Date of birth</Text>
					<TextInput
						style={styles.input}
						placeholder="YYYY-MM-DD"
						placeholderTextColor={theme.authTextHint}
						value={birthDate}
						onChangeText={setBirthDate}
						autoCapitalize="none"
					/>

					<Text style={styles.label}>Height (cm)</Text>
					<TextInput
						style={styles.input}
						placeholder="175"
						placeholderTextColor={theme.authTextHint}
						value={heightCm}
						onChangeText={setHeightCm}
						keyboardType="decimal-pad"
					/>

					<Text style={styles.label}>Weight</Text>
					<View style={styles.row}>
						<TextInput
							style={[styles.input, styles.grow]}
							placeholder={weightUnit === "kg" ? "70" : "154"}
							placeholderTextColor={theme.authTextHint}
							value={weightVal}
							onChangeText={setWeightVal}
							keyboardType="decimal-pad"
						/>
						<Pills options={["kg", "lb"] as const} value={weightUnit} onSelect={setWeightUnit} />
					</View>

					<Text style={styles.label}>Activity level</Text>
					<Pills options={ACTIVITY_LEVELS} value={activity} onSelect={setActivity} labels={ACTIVITY_LABELS} />

					<Text style={styles.label}>Goal</Text>
					<Pills options={GOAL_TYPES} value={goalType} onSelect={setGoalType} labels={GOAL_TYPE_LABELS} />

					{error && <Text style={styles.error}>{error}</Text>}

					<TouchableOpacity style={styles.primaryButton} onPress={goToReview} disabled={estimating}>
						{estimating ? <ActivityIndicator color={theme.textInverse} /> : <Text style={styles.primaryButtonText}>Continue</Text>}
					</TouchableOpacity>
					<TouchableOpacity style={styles.skip} onPress={handleSkip} disabled={saving}>
						<Text style={styles.skipText}>Skip for now</Text>
					</TouchableOpacity>
				</>
			) : (
				<>
					<Text style={styles.title}>Your daily goals</Text>
					<Text style={styles.subtitle}>Based on your details. Tweak any number that doesn&apos;t feel right.</Text>

					{MACRO_KEYS.map((k) => (
						<View key={k} style={styles.goalRow}>
							<Text style={styles.goalLabel}>{MACRO_META[k].label}</Text>
							<TextInput
								style={styles.goalInput}
								value={goals[k]}
								onChangeText={(t) => setGoals((g) => ({ ...g, [k]: t.replace(/[^0-9]/g, "") }))}
								keyboardType="number-pad"
							/>
							<Text style={styles.unit}>{MACRO_META[k].unit}</Text>
						</View>
					))}

					{error && <Text style={styles.error}>{error}</Text>}

					<TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={saving}>
						{saving ? <ActivityIndicator color={theme.textInverse} /> : <Text style={styles.primaryButtonText}>Save &amp; get started</Text>}
					</TouchableOpacity>
					<TouchableOpacity style={styles.skip} onPress={() => setStep(1)} disabled={saving}>
						<Text style={styles.skipText}>Back</Text>
					</TouchableOpacity>
				</>
			)}
		</KeyboardAwareScrollView>
	);
}
