import { useState } from "react";
import { View, TextInput, StyleSheet, type StyleProp, type TextStyle } from "react-native";
import Pills from "@/components/Pills";

// Height and weight inputs that let people type in the units they think in.
// The value in and out is always metric (cm / kg as a string), which is what the API stores.

const CM_PER_IN = 2.54;
const KG_PER_LB = 0.45359237;

const round1 = (n: number) => String(Math.round(n * 10) / 10);
const clean = (t: string) => t.replace(/[^0-9.]/g, "");

interface FieldProps {
	value: string;
	onChange: (metric: string) => void;
	inputStyle: StyleProp<TextStyle>;
	placeholderColor: string;
}

export function HeightField({ value, onChange, inputStyle, placeholderColor }: FieldProps) {
	const [unit, setUnit] = useState<"cm" | "ft">("cm");
	const cm = parseFloat(value);
	const totalIn = cm > 0 ? cm / CM_PER_IN : 0;
	const [feet, setFeet] = useState(totalIn ? String(Math.floor(totalIn / 12)) : "");
	const [inches, setInches] = useState(totalIn ? String(Math.round(totalIn % 12)) : "");

	function switchUnit(next: "cm" | "ft") {
		if (next === "ft" && totalIn) {
			setFeet(String(Math.floor(totalIn / 12)));
			setInches(String(Math.round(totalIn % 12)));
		}
		setUnit(next);
	}

	function updateImperial(f: string, i: string) {
		setFeet(f);
		setInches(i);
		const total = (parseFloat(f) || 0) * 12 + (parseFloat(i) || 0);
		onChange(total > 0 ? round1(total * CM_PER_IN) : "");
	}

	return (
		<View style={styles.row}>
			{unit === "cm" ? (
				<TextInput
					style={[inputStyle, styles.grow]}
					placeholder="175"
					placeholderTextColor={placeholderColor}
					value={value}
					onChangeText={(t) => onChange(clean(t))}
					keyboardType="decimal-pad"
					accessibilityLabel="Height in centimetres"
				/>
			) : (
				<>
					<TextInput
						style={[inputStyle, styles.grow]}
						placeholder="5 ft"
						placeholderTextColor={placeholderColor}
						value={feet}
						onChangeText={(t) => updateImperial(clean(t), inches)}
						keyboardType="number-pad"
						accessibilityLabel="Height, feet"
					/>
					<TextInput
						style={[inputStyle, styles.grow]}
						placeholder="9 in"
						placeholderTextColor={placeholderColor}
						value={inches}
						onChangeText={(t) => updateImperial(feet, clean(t))}
						keyboardType="decimal-pad"
						accessibilityLabel="Height, inches"
					/>
				</>
			)}
			<Pills options={["cm", "ft"] as const} value={unit} onSelect={switchUnit} labels={{ cm: "cm", ft: "ft / in" }} />
		</View>
	);
}

export function WeightField({ value, onChange, inputStyle, placeholderColor }: FieldProps) {
	const [unit, setUnit] = useState<"kg" | "lb">("kg");
	const kg = parseFloat(value);
	const [lbText, setLbText] = useState(kg > 0 ? round1(kg / KG_PER_LB) : "");

	function switchUnit(next: "kg" | "lb") {
		if (next === "lb") setLbText(kg > 0 ? round1(kg / KG_PER_LB) : "");
		setUnit(next);
	}

	return (
		<View style={styles.row}>
			<TextInput
				style={[inputStyle, styles.grow]}
				placeholder={unit === "kg" ? "70" : "154"}
				placeholderTextColor={placeholderColor}
				value={unit === "kg" ? value : lbText}
				onChangeText={(t) => {
					const next = clean(t);
					if (unit === "kg") return onChange(next);
					setLbText(next);
					const lb = parseFloat(next);
					onChange(lb > 0 ? String(Math.round(lb * KG_PER_LB * 100) / 100) : "");
				}}
				keyboardType="decimal-pad"
				accessibilityLabel={unit === "kg" ? "Weight in kilograms" : "Weight in pounds"}
			/>
			<Pills options={["kg", "lb"] as const} value={unit} onSelect={switchUnit} />
		</View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", gap: 10, alignItems: "center" },
	grow: { flex: 1 },
});
