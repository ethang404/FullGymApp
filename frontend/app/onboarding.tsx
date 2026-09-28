import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { router } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import Pills from "@/components/Pills";
import Screen from "@/components/Screen";
import { DateField } from "@/components/DateField";
import { HeightField, WeightField } from "@/components/MeasurementFields";
import { fonts, APP_NAME } from "@/theme/typography";
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
	const [weightKgText, setWeightKgText] = useState("");
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
			router.replace("/Home");
		}
	}, [loading, profile?.onboarding_completed]);

	

	function buildBody(): EstimateBody | null {
		if (!sex || !DATE_RE.test(birthDate) || !activity || !goalType) return null;
		const h = parseFloat(heightCm);
		const weightKg = parseFloat(weightKgText);
		if (!h || h <= 0 || !weightKg || weightKg <= 0) return null;
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
			setError("Fill in every field to continue, or tap Skip for now.");
			return;
		}
		setError(null);
		setEstimating(true);
		try {
			const est = await estimateGoals(body);
			setGoals(Object.fromEntries(MACRO_KEYS.map((k) => [k, String(est.goals[k])])));
		} catch {
			// fall back to defaults already in state
			setError("Couldn't work out your goals, so we've filled in standard ones. Change any number you like.");
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
			router.replace("/Home");
		} catch {
			setError("Your goals didn't save. Check your connection and try again.");
			setSaving(false);
		}
	}

	async function handleSkip() {
		setSaving(true);
		try {
			await updateProfile({ onboarding_completed: true });
			router.replace("/Home");
		} catch {
			setError("Couldn't skip right now. Check your connection and try again.");
			setSaving(false);
		}
	}

	const styles = useMemo(
		() =>
			StyleSheet.create({
				container: { flexGrow: 1, backgroundColor: theme.authBackground, padding: 20 },
				title: { fontSize: 30, lineHeight: 36, fontFamily: fonts.headingHeavy, color: theme.authText, marginBottom: 4 },
				stepText: { fontSize: 13, fontWeight: "600", color: theme.primary, marginBottom: 6 },
				stepTrack: { flexDirection: "row", gap: 6, marginBottom: 18 },
				stepDot: { flex: 1, height: 4, borderRadius: 2 },
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

	const stepHeader = (n: 1 | 2) => (
		<>
			<Text style={styles.stepText}>Step {n} of 2</Text>
			<View style={styles.stepTrack}>
				{[1, 2].map((i) => (
					<View key={i} style={[styles.stepDot, { backgroundColor: i <= n ? theme.primary : theme.authCardBorder }]} />
				))}
			</View>
		</>
	);

	if (loading) {
		return (
			<Screen edges={["top", "bottom"]} background={theme.authBackground} style={{ alignItems: "center", justifyContent: "center" }}>
				<ActivityIndicator color={theme.primary} size="large" />
			</Screen>
		);
	}

	return (
		<Screen edges={["top", "bottom"]} background={theme.authBackground}>
			<KeyboardAwareScrollView style={{ flex: 1 }} contentContainerStyle={styles.container} enableOnAndroid extraScrollHeight={40} keyboardShouldPersistTaps="handled">
			{step === 1 ? (
				<>
					{stepHeader(1)}
					<Text style={styles.title}>Welcome to {APP_NAME}</Text>
					<Text style={styles.subtitle}>
						Tell us a little about yourself and we&apos;ll suggest how much to eat each day. You can change anything
						later under You.
					</Text>

					<Text style={styles.label}>Sex</Text>
					<Pills options={SEXES} value={sex} onSelect={setSex} labels={{ male: "Male", female: "Female" }} />

					<Text style={styles.label}>Date of birth</Text>
					<DateField
						value={birthDate}
						onChange={setBirthDate}
						placeholder="Select your birth date"
						fieldStyle={styles.input}
						textStyle={{ color: theme.authInputText, fontSize: 15 }}
					/>

					<Text style={styles.label}>Height</Text>
					<HeightField value={heightCm} onChange={setHeightCm} inputStyle={styles.input} placeholderColor={theme.authTextHint} />

					<Text style={styles.label}>Weight</Text>
					<WeightField value={weightKgText} onChange={setWeightKgText} inputStyle={styles.input} placeholderColor={theme.authTextHint} />

					<Text style={styles.label}>How active are you day to day?</Text>
					<Pills options={ACTIVITY_LEVELS} value={activity} onSelect={setActivity} labels={ACTIVITY_LABELS} />

					<Text style={styles.label}>What are you aiming for?</Text>
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
					{stepHeader(2)}
					<Text style={styles.title}>Your daily goals</Text>
					<Text style={styles.subtitle}>Here&apos;s what we suggest. Change any number that doesn&apos;t feel right.</Text>

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
						{saving ? <ActivityIndicator color={theme.textInverse} /> : <Text style={styles.primaryButtonText}>Save and start</Text>}
					</TouchableOpacity>
					<TouchableOpacity style={styles.skip} onPress={() => setStep(1)} disabled={saving}>
						<Text style={styles.skipText}>Back</Text>
					</TouchableOpacity>
				</>
			)}
			</KeyboardAwareScrollView>
		</Screen>
	);
}
