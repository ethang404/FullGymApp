// Every theme is checked against WCAG AA: body text and `primary` hit 4.5:1 on
// cardBg/background/cardBgAlt, `textInverse` hits 4.5:1 on `primary` (button labels),
// and textTertiary / placeholders / macro colors hit 3:1 (icons and graphics).
// Re-check contrast when changing any of these values.

//Leaf green / butter / tomato on fresh paper — the Hearty default
export const heartyTheme = {
	// Core
	primary: "#2F7A4E",
	background: "#F4F7F1",
	cardBg: "#FFFFFF",
	cardBgAlt: "#EAF1E6",

	// Text
	text: "#1F2A23",
	textMuted: "#56645B",
	textSecondary: "#3D4A42",
	textTertiary: "#7A877F",
	textQuaternary: "#C9D3CB",
	textInverse: "#FFFFFF",

	// Auth
	authBackground: "#F4F7F1",
	authCardBg: "#FFFFFF",
	authCardBorder: "#DDE5D8",
	authText: "#1F2A23",
	authTextMuted: "#56645B",
	authTextHint: "#7A877F",
	authInputBg: "#FFFFFF",
	authInputBorder: "#CFD9CA",
	authInputText: "#1F2A23",
	authLabel: "#3D4A42",

	// Inputs
	inputBg: "#FFFFFF",
	inputBorder: "#CFD9CA",
	inputPlaceholder: "#7A877F",

	// Borders
	border: "#DDE5D8",
	borderLight: "#EAF1E6",

	// Semantic
	error: "#C23B2B",
	accent: "#F2B53A", // butter — celebration moments only
	dotActive: "#2F7A4E",

	// Macros (nutrition rings/bars) — tomato / honey / plum
	macroProtein: "#C0442E",
	macroCarbs: "#A86A00",
	macroFat: "#6B4FA0",

	// Overlays
	overlay: "rgba(0,0,0,0.5)",

	// Shadows
	shadowColor: "#000000",
};

//Cream/Coral/Sage/Lavender — soft and warm
export const sorbetTheme: Theme = {
	// Core
	primary: "#B34824",
	background: "#FDF6F0",
	cardBg: "#FFFFFF",
	cardBgAlt: "#FBEEE6",

	// Text
	text: "#4A4A4A",
	textMuted: "#7A6150",
	textSecondary: "#6B5A4D",
	textTertiary: "#A08878",
	textQuaternary: "#E3D5C8",
	textInverse: "#FFFFFF",

	// Auth
	authBackground: "#FDF6F0",
	authCardBg: "#FFFFFF",
	authCardBorder: "#F0E1D5",
	authText: "#4A4A4A",
	authTextMuted: "#7A6150",
	authTextHint: "#A08878",
	authInputBg: "#FFFFFF",
	authInputBorder: "#E8D9CE",
	authInputText: "#4A4A4A",
	authLabel: "#6B5A4D",

	// Inputs
	inputBg: "#FFFFFF",
	inputBorder: "#E8D9CE",
	inputPlaceholder: "#A08878",

	// Borders
	border: "#F0E1D5",
	borderLight: "#FBEEE6",

	// Semantic
	error: "#C0473A",
	accent: "#FF9C7A",
	dotActive: "#B34824",

	// Macros (nutrition rings/bars) — sage / coral / lavender trio
	macroProtein: "#3F8A64",
	macroCarbs: "#D85A30",
	macroFat: "#7F6BAE",

	// Overlays
	overlay: "rgba(0,0,0,0.5)",

	// Shadows
	shadowColor: "#000000",
};

//Lavender/white
export const lavenderTheme: Theme = {
	// Core
	primary: "#6E4DB3",
	background: "#F6F3FC",
	cardBg: "#FFFFFF",
	cardBgAlt: "#EDE6F8",

	// Text
	text: "#2C2438",
	textMuted: "#6B5E7C",
	textSecondary: "#5C4E6B",
	textTertiary: "#8E82A0",
	textQuaternary: "#D1C7DC",
	textInverse: "#FFFFFF",

	// Auth
	authBackground: "#F1EBFA",
	authCardBg: "#FFFFFF",
	authCardBorder: "#DCCEF0",
	authText: "#2C2438",
	authTextMuted: "#6B5E7C",
	authTextHint: "#8E82A0",
	authInputBg: "#FFFFFF",
	authInputBorder: "#D6C6EC",
	authInputText: "#2C2438",
	authLabel: "#5C4E6B",

	// Inputs
	inputBg: "#FFFFFF",
	inputBorder: "#D6C6EC",
	inputPlaceholder: "#8E82A0",

	// Borders
	border: "#DCCEF0",
	borderLight: "#EDE6F8",

	// Semantic
	error: "#C23A4F",
	accent: "#C8B6E2",
	dotActive: "#6E4DB3",

	// Macros (nutrition rings/bars) — deeper shades for contrast on light backgrounds
	macroProtein: "#15803D",
	macroCarbs: "#0369A1",
	macroFat: "#C2410C",

	// Overlays
	overlay: "rgba(0,0,0,0.5)",

	// Shadows
	shadowColor: "#000000",
};

//White/Black — the one dark theme
export const midnightTheme: Theme = {
	// Core
	primary: "#FFFFFF",
	background: "#000000",
	cardBg: "#0F0F0F",
	cardBgAlt: "#1A1A1A",

	// Text
	text: "#FFFFFF",
	textMuted: "#A3A3A3",
	textSecondary: "#CCCCCC",
	textTertiary: "#7A7A7A",
	textQuaternary: "#444444",
	textInverse: "#000000",

	// Auth
	authBackground: "#000000",
	authCardBg: "#0F0F0F",
	authCardBorder: "#222222",
	authText: "#FFFFFF",
	authTextMuted: "#A3A3A3",
	authTextHint: "#7A7A7A",
	authInputBg: "#000000",
	authInputBorder: "#2A2A2A",
	authInputText: "#FFFFFF",
	authLabel: "#CCCCCC",

	// Inputs
	inputBg: "#111111",
	inputBorder: "#2A2A2A",
	inputPlaceholder: "#7A7A7A",

	// Borders
	border: "#222222",
	borderLight: "#2F2F2F",

	// Semantic
	error: "#FF6B6B",
	accent: "#FFFFFF",
	dotActive: "#FFFFFF",

	// Macros (nutrition rings/bars)
	macroProtein: "#4ADE80",
	macroCarbs: "#38BDF8",
	macroFat: "#FB923C",

	// Overlays
	overlay: "rgba(0,0,0,0.5)",

	// Shadows
	shadowColor: "#000000",
};

export type Theme = typeof heartyTheme; //creates a type of Theme, must contain primary/backgreound etc.

//so this is a string type, but where it's only allowed to be these strings here
export type ThemeName = "hearty" | "sorbet" | "lavender" | "midnight";

//Combine theme name w/ theme
//Think of zip in python
export const themes: Record<ThemeName, Theme> = {
	hearty: heartyTheme,
	sorbet: sorbetTheme,
	lavender: lavenderTheme,
	midnight: midnightTheme,
};

// Display label for each theme
export const themeLabels: Record<ThemeName, string> = {
	hearty: "Hearty",
	sorbet: "Sorbet",
	lavender: "Lavender",
	midnight: "Midnight",
};

// Default theme — used wherever the app initializes its theme state.
// A saved theme that no longer exists (older builds had 9) falls back to this.
export const defaultThemeName: ThemeName = "hearty";
