import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useTheme } from "@/theme/ThemeProvider";
import { formatMediumDate, parseISODate, toISODate } from "@/utils/date";

interface DateFieldProps {
	/** `YYYY-MM-DD` or `""`. */
	value: string;
	onChange: (iso: string) => void;
	placeholder?: string;
	/** Style for the tappable box (mirror the screen's text-input style). */
	fieldStyle?: StyleProp<ViewStyle>;
	/** Style for the value/placeholder text inside the box. */
	textStyle?: StyleProp<TextStyle>;
}

const MIN_DATE = new Date(1900, 0, 1);
const FALLBACK = new Date(2000, 0, 1);

// A tappable field that opens the OS date picker (Android dialog / iOS inline
// spinner). Emits a local `YYYY-MM-DD` string — the format the API already uses.
export function DateField({ value, onChange, placeholder = "Select date", fieldStyle, textStyle }: DateFieldProps) {
	const { theme } = useTheme();
	const [iosOpen, setIosOpen] = useState(false);
	const current = parseISODate(value) ?? FALLBACK;
	const today = new Date();

	// onValueChange only fires when a date is actually picked (dismissing doesn't call it).
	const commit = (_event: unknown, picked: Date) => onChange(toISODate(picked));

	const open = () => {
		if (Platform.OS === "android") {
			DateTimePickerAndroid.open({ value: current, mode: "date", maximumDate: today, minimumDate: MIN_DATE, onValueChange: commit });
		} else {
			setIosOpen((v) => !v);
		}
	};

	return (
		<>
			<Pressable style={fieldStyle} onPress={open}>
				<Text style={[textStyle, !value && { opacity: 0.5 }]}>{value ? formatMediumDate(value) : placeholder}</Text>
			</Pressable>

			{Platform.OS === "ios" && iosOpen && (
				<View style={styles.iosWrap}>
					<DateTimePicker
						value={current}
						mode="date"
						display="spinner"
						maximumDate={today}
						minimumDate={MIN_DATE}
						onValueChange={commit}
					/>
					<Pressable onPress={() => setIosOpen(false)} hitSlop={10} style={styles.doneBtn}>
						<Text style={[styles.doneText, { color: theme.primary }]}>Done</Text>
					</Pressable>
				</View>
			)}
		</>
	);
}

const styles = StyleSheet.create({
	iosWrap: { alignItems: "center" },
	doneBtn: { alignSelf: "flex-end", paddingHorizontal: 8, paddingVertical: 6 },
	doneText: { fontWeight: "700", fontSize: 15 },
});
