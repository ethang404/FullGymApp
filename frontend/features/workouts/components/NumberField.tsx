import { useState } from "react";
import { TextInput, type StyleProp, type TextStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

//A number text box. Keeps the typed text itself so "12." doesn't jump back to "12" mid-typing,
//and reports a number (or null when empty) to the parent.
export function NumberField({
	value,
	onChangeValue,
	placeholder,
	decimal = false,
	style,
}: {
	value: number | null;
	onChangeValue: (n: number | null) => void;
	placeholder?: string;
	decimal?: boolean;
	style?: StyleProp<TextStyle>;
}) {
	const { theme } = useTheme();
	const [text, setText] = useState(value == null ? "" : String(value));

	const handleChange = (raw: string) => {
		//digits only, plus a single "." for weights
		const cleaned = decimal ? raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1") : raw.replace(/[^0-9]/g, "");
		setText(cleaned);
		onChangeValue(cleaned === "" || cleaned === "." ? null : Number(cleaned));
	};

	return (
		<TextInput
			style={style}
			value={text}
			onChangeText={handleChange}
			placeholder={placeholder}
			placeholderTextColor={theme.inputPlaceholder}
			keyboardType={decimal ? "decimal-pad" : "number-pad"}
			selectTextOnFocus
		/>
	);
}
