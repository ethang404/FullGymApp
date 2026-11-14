import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { router } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import Screen from "@/components/Screen";
import { fonts, APP_NAME } from "@/theme/typography";
import { useProfile, type EstimateBody } from "@/utils/ProfileProvider";
import { SectionLabel } from "@/features/onboarding/components/Card";
import { SexPicker } from "@/features/onboarding/components/SexPicker";
import { BirthDateCard } from "@/features/onboarding/components/BirthDateCard";
import { HeightCard } from "@/features/onboarding/components/HeightCard";
import { WeightGoalCard } from "@/features/onboarding/components/WeightGoalCard";
import { ActivityPicker } from "@/features/onboarding/components/ActivityPicker";
import { GoalsReview } from "@/features/onboarding/components/GoalsReview";
import { MACRO_KEYS, MACRO_META, GOAL_DEFAULTS, type Sex, type ActivityLevel, type GoalType, type MacroGoals } from "@/utils/macroDefaults";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const STEPS = {
	1: { title: "About you", tag: "Body basics" },
	2: { title: "Your goals", tag: "Daily targets" },
} as const;

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
	const [goals, setGoals] = useState<Record<string, string>>(Object.fromEntries(MACRO_KEYS.map((k) => [k, String(GOAL_DEFAULTS[k])])));
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
				header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
				headerSide: { width: 64 },
				headerTitle: { flex: 1, textAlign: "center", color: theme.authText, fontSize: 16, fontWeight: "700" },
				iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
				// marginBottom is the gap between "Skip for now" and the Continue button
				skip: { alignSelf: "center", paddingVertical: 4, marginBottom: 26 },
				skipText: { color: theme.authTextMuted, fontSize: 14, fontWeight: "600" },

				progress: { paddingHorizontal: 20, paddingTop: 8 },
				progressLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
				stepText: { color: theme.primary, fontSize: 13, fontWeight: "700" },
				stepTag: { color: theme.authTextMuted, fontSize: 13 },
				progressTrack: { height: 4, borderRadius: 2, backgroundColor: theme.authCardBorder, overflow: "hidden" },
				progressFill: { height: 4, borderRadius: 2, backgroundColor: theme.primary },

				container: { flexGrow: 1, padding: 20, paddingTop: 20, paddingBottom: 32 },
				title: { fontSize: 30, lineHeight: 36, fontFamily: fonts.headingHeavy, color: theme.authText, marginBottom: 6 },
				subtitle: { fontSize: 15, lineHeight: 21, color: theme.authTextMuted, marginBottom: 4 },
				cardGap: { height: 12 },

				footer: {
					paddingHorizontal: 20,
					paddingTop: 12,
					paddingBottom: 8,
					borderTopWidth: StyleSheet.hairlineWidth,
					borderTopColor: theme.authCardBorder,
					backgroundColor: theme.authBackground,
				},
				error: { color: theme.error, fontSize: 13, marginBottom: 10 },
				footerRow: { flexDirection: "row", gap: 12 },
				backButton: {
					width: 54,
					height: 54,
					borderRadius: 16,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: theme.authCardBg,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.authCardBorder,
				},
				primaryButton: {
					flex: 1,
					height: 54,
					borderRadius: 16,
					flexDirection: "row",
					gap: 10,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: theme.primary,
				},
				primaryButtonText: { color: theme.textInverse, fontSize: 16, fontWeight: "700" },
			}),
		[theme],
	);

	if (loading) {
		return (
			<Screen edges={["top", "bottom"]} background={theme.authBackground} style={{ alignItems: "center", justifyContent: "center" }}>
				<ActivityIndicator color={theme.primary} size="large" />
			</Screen>
		);
	}

	const busy = estimating || saving; // disable buttons while anything is running
	const continueLoading = step === 1 ? estimating : saving; // spinner only for Continue's own work

	return (
		<Screen edges={["top", "bottom"]} background={theme.authBackground}>
			<View style={styles.header}>
				<View style={styles.headerSide}>
					{step === 2 && (
						<Pressable style={styles.iconButton} onPress={() => setStep(1)} disabled={saving} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
							<FontAwesome5 name="arrow-left" size={18} color={theme.authText} />
						</Pressable>
					)}
				</View>
				<Text style={styles.headerTitle}>{STEPS[step].title}</Text>
				{/* empty slot the same width as the back button's, so the title stays centered */}
				<View style={styles.headerSide} />
			</View>

			<View style={styles.progress}>
				<View style={styles.progressLabels}>
					<Text style={styles.stepText}>Step {step} of 2</Text>
					<Text style={styles.stepTag}>{STEPS[step].tag}</Text>
				</View>
				<View style={styles.progressTrack}>
					<View style={[styles.progressFill, { width: step === 1 ? "50%" : "100%" }]} />
				</View>
			</View>

			<KeyboardAwareScrollView
				style={{ flex: 1 }}
				contentContainerStyle={styles.container}
				enableOnAndroid
				extraScrollHeight={40}
				keyboardShouldPersistTaps="handled"
			>
				{step === 1 ? (
					<>
						<Text style={styles.title}>Welcome to {APP_NAME}</Text>
						<Text style={styles.subtitle}>
							Tell us a little about yourself and we&apos;ll suggest how much to eat each day. You can change anything later under You.
						</Text>

						<SectionLabel>Sex</SectionLabel>
						<SexPicker value={sex} onChange={setSex} />

						<View style={styles.cardGap} />
						<BirthDateCard value={birthDate} onChange={setBirthDate} />

						<View style={styles.cardGap} />
						<HeightCard value={heightCm} onChange={setHeightCm} />

						<View style={styles.cardGap} />
						<WeightGoalCard weightKg={weightKgText} onWeightChange={setWeightKgText} goalType={goalType} onGoalTypeChange={setGoalType} />

						<SectionLabel>How active are you day to day?</SectionLabel>
						<ActivityPicker value={activity} onChange={setActivity} />
					</>
				) : (
					<>
						<Text style={styles.title}>Your daily goals</Text>
						<Text style={[styles.subtitle, { marginBottom: 20 }]}>Here&apos;s what we suggest. Change any number that doesn&apos;t feel right.</Text>

						<GoalsReview goals={goals} onChange={(k, t) => setGoals((g) => ({ ...g, [k]: t.replace(/[^0-9]/g, "") }))} />
					</>
				)}
			</KeyboardAwareScrollView>

			<View style={styles.footer}>
				{error && <Text style={styles.error}>{error}</Text>}
				{step === 1 && (
					<Pressable style={styles.skip} onPress={handleSkip} disabled={busy} hitSlop={8} accessibilityRole="button">
						<Text style={styles.skipText}>Skip for now</Text>
					</Pressable>
				)}
				<View style={styles.footerRow}>
					{step === 2 && (
						<Pressable style={styles.backButton} onPress={() => setStep(1)} disabled={saving} accessibilityRole="button" accessibilityLabel="Back">
							<FontAwesome5 name="arrow-left" size={16} color={theme.authText} />
						</Pressable>
					)}
					<Pressable
						style={({ pressed }) => [styles.primaryButton, (pressed || busy) && { opacity: 0.85 }]}
						onPress={step === 1 ? goToReview : handleSave}
						disabled={busy}
						accessibilityRole="button"
					>
						{continueLoading ? (
							<ActivityIndicator color={theme.textInverse} />
						) : (
							<>
								<Text style={styles.primaryButtonText}>{step === 1 ? "Continue" : "Save and start"}</Text>
								<FontAwesome5 name="arrow-right" size={14} color={theme.textInverse} />
							</>
						)}
					</Pressable>
				</View>
			</View>
		</Screen>
	);
}
