import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/typography";
import { parseISODate, toISODate } from "@/utils/date";
import { Card, CardHeader } from "./Card";

// The person types an age, but the API stores a birth date. So the value in and out
// is still a YYYY-MM-DD string: we show the age it works out to, and save "today minus
// that many years". That date can be up to a year off from their real birthday, which
// barely matters: the calorie formula only moves 5 kcal per year of age.

const MIN_AGE = 13;
const MAX_AGE = 100;
const START_AGE = 25; // where the -/+ buttons start from when the box is empty

// Whole years since `iso`, or null if it isn't a usable date.
function ageFrom(iso: string): number | null {
	const birth = parseISODate(iso);
	if (!birth) return null;
	const now = new Date();
	let age = now.getFullYear() - birth.getFullYear();
	const beforeBirthday = now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
	if (beforeBirthday) age -= 1;
	return age >= 0 ? age : null;
}

// A birth date that makes someone exactly `age` today.
function birthDateFor(age: number): string {
	const now = new Date();
	const birth = new Date(now.getFullYear() - age, now.getMonth(), now.getDate());
	// Feb 29 today rolls over to Mar 1 in a non-leap year, which would make them a year younger
	if (birth.getMonth() !== now.getMonth()) birth.setDate(0);
	return toISODate(birth);
}

const isValidAge = (n: number) => Number.isInteger(n) && n >= MIN_AGE && n <= MAX_AGE;

export function AgeCard({ value, onChange }: { value: string; onChange: (birthDateIso: string) => void }) {
	const { theme } = useTheme();

	// What's in the box. Kept here so typing "1" on the way to "19" isn't overwritten.
	const [text, setText] = useState(() => {
		const age = ageFrom(value);
		return age == null ? "" : String(age);
	});

	const typed = parseInt(text, 10);
	const showRangeHint = text !== "" && !isValidAge(typed);

	function setAge(nextText: string) {
		setText(nextText);
		const n = parseInt(nextText, 10);
		// An empty or out-of-range age clears the birth date, so Continue asks for it
		onChange(isValidAge(n) ? birthDateFor(n) : "");
	}

	function nudge(delta: 1 | -1) {
		const next = isValidAge(typed) ? Math.min(MAX_AGE, Math.max(MIN_AGE, typed + delta)) : START_AGE;
		setAge(String(next));
	}

	const styles = useMemo(
		() =>
			StyleSheet.create({
				row: { flexDirection: "row", alignItems: "center", gap: 12 },
				header: { flex: 1 },
				stepper: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.cardBgAlt, borderRadius: 12, padding: 4 },
				stepButton: {
					width: 32,
					height: 32,
					borderRadius: 8,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: theme.cardBg,
				},
				valueBox: { flexDirection: "row", alignItems: "baseline", paddingHorizontal: 4 },
				input: { color: theme.text, fontSize: 22, fontFamily: fonts.heading, minWidth: 30, textAlign: "center", paddingVertical: 0 },
				unit: { color: theme.textMuted, fontSize: 12, marginLeft: 2 },
			}),
		[theme],
	);

	return (
		<Card>
			<View style={styles.row}>
				<View style={styles.header}>
					<CardHeader title="Age" subtitle={showRangeHint ? `Enter an age from ${MIN_AGE} to ${MAX_AGE}` : "Young or old 😊. We're here"} />
				</View>
				<View style={styles.stepper}>
					<Pressable style={styles.stepButton} onPress={() => nudge(-1)} accessibilityRole="button" accessibilityLabel="Younger" hitSlop={4}>
						<FontAwesome5 name="minus" size={12} color={theme.text} />
					</Pressable>
					<View style={styles.valueBox}>
						<TextInput
							style={styles.input}
							value={text}
							onChangeText={(t) => setAge(t.replace(/[^0-9]/g, ""))}
							keyboardType="number-pad"
							maxLength={3}
							placeholder="—"
							placeholderTextColor={theme.textTertiary}
							selectTextOnFocus
							accessibilityLabel="Age in years"
						/>
						<Text style={styles.unit}>yrs</Text>
					</View>
					<Pressable style={styles.stepButton} onPress={() => nudge(1)} accessibilityRole="button" accessibilityLabel="Older" hitSlop={4}>
						<FontAwesome5 name="plus" size={12} color={theme.text} />
					</Pressable>
				</View>
			</View>
		</Card>
	);
}
