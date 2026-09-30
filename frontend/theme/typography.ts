import { Baloo2_600SemiBold, Baloo2_700Bold, Baloo2_800ExtraBold } from "@expo-google-fonts/baloo-2";

// Baloo 2 is used for headings, big numbers and the wordmark only. Body text stays on the
// system font so long lists and forms remain easy to read.
// Each weight is its own family: don't also set fontWeight on these, or Android falls
// back to the system font.
export const fontAssets = {
	Baloo2_600SemiBold,
	Baloo2_700Bold,
	Baloo2_800ExtraBold,
};

export const fonts = {
	headingMedium: "Baloo2_600SemiBold",
	heading: "Baloo2_700Bold",
	headingHeavy: "Baloo2_800ExtraBold",
} as const;

export const APP_NAME = "Hearty";
