import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

// A wrapping row of single-select pills. Used by the onboarding flow and the
// Profile body-metrics modal.
export default function Pills<T extends string>({
	options,
	value,
	onSelect,
	labels,
}: {
	options: readonly T[];
	value: T | null;
	onSelect: (v: T) => void;
	labels?: Record<string, string>;
}) {
	const { theme } = useTheme();
	return (
		<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
			{options.map((opt) => {
				const active = value === opt;
				return (
					<TouchableOpacity
						key={opt}
						onPress={() => onSelect(opt)}
						activeOpacity={0.7}
						style={{
							paddingHorizontal: 14,
							paddingVertical: 9,
							borderRadius: 999,
							borderWidth: 1.5,
							borderColor: active ? theme.primary : theme.border,
							backgroundColor: active ? `${theme.primary}22` : theme.cardBg,
						}}
					>
						<Text style={{ fontSize: 13, fontWeight: "600", color: active ? theme.primary : theme.textMuted }}>
							{labels?.[opt] ?? opt}
						</Text>
					</TouchableOpacity>
				);
			})}
		</View>
	);
}
