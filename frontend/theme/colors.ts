// Every theme is checked against WCAG AA: body text and `primary` hit 4.5:1 on
// cardBg/background/cardBgAlt, `textInverse` hits 4.5:1 on `primary` (button labels),
// and textTertiary / placeholders / macro colors hit 3:1 (icons and graphics).
// Re-check contrast when changing any of these values.
// All themes are dark: filled buttons are a light tint with dark `textInverse` labels.

//Sage green / warm cream / slate on charcoal — the Hearty default
export const sageTheme = {
	// Core
	primary: "#8EBA91",
	background: "#121417",
	cardBg: "#1C1E22",
	cardBgAlt: "#26292E",

	// Text
	text: "#E8E6DF",
	textMuted: "#A4A9B3",
	textSecondary: "#C9C7C0",
	textTertiary: "#7D828B",
	textQuaternary: "#3A3D43",
	textInverse: "#121417",

	// Auth
	authBackground: "#121417",
	authCardBg: "#1C1E22",
	authCardBorder: "#2E3136",
	authText: "#E8E6DF",
	authTextMuted: "#A4A9B3",
	authTextHint: "#7D828B",
	authInputBg: "#121417",
	authInputBorder: "#3A3D43",
	authInputText: "#E8E6DF",
	authLabel: "#C9C7C0",

	// Inputs
	inputBg: "#121417",
	inputBorder: "#3A3D43",
	inputPlaceholder: "#7D828B",

	// Borders
	border: "#2E3136",
	borderLight: "#26292E",

	// Semantic
	error: "#F2A39B",
	accent: "#E8E6DF", // cream — celebration moments only
	dotActive: "#8EBA91",

	// Macros (nutrition rings/bars) — rose / honey / periwinkle
	macroProtein: "#F2A39B",
	macroCarbs: "#E6C77A",
	macroFat: "#A4B8DE",

	// Overlays
	overlay: "rgba(0,0,0,0.6)",

	// Shadows
	shadowColor: "#000000",
};

//Honey / coral / blue slate on navy charcoal
export const honeyTheme: Theme = {
	// Core
	primary: "#F3BA4F",
	background: "#161A22",
	cardBg: "#1F242D",
	cardBgAlt: "#292F39",

	// Text
	text: "#ECEAE4",
	textMuted: "#A6B1C2",
	textSecondary: "#D4CABA",
	textTertiary: "#7F8B9C",
	textQuaternary: "#3B4352",
	textInverse: "#161A22",

	// Auth
	authBackground: "#161A22",
	authCardBg: "#1F242D",
	authCardBorder: "#323947",
	authText: "#ECEAE4",
	authTextMuted: "#A6B1C2",
	authTextHint: "#7F8B9C",
	authInputBg: "#161A22",
	authInputBorder: "#3B4352",
	authInputText: "#ECEAE4",
	authLabel: "#D4CABA",

	// Inputs
	inputBg: "#161A22",
	inputBorder: "#3B4352",
	inputPlaceholder: "#7F8B9C",

	// Borders
	border: "#323947",
	borderLight: "#292F39",

	// Semantic
	error: "#FF9A8F",
	accent: "#E07A5F", // coral — celebration moments only
	dotActive: "#F3BA4F",

	// Macros (nutrition rings/bars) — coral / honey / blue slate
	macroProtein: "#E8836A",
	macroCarbs: "#F3C46A",
	macroFat: "#9DB6DA",

	// Overlays
	overlay: "rgba(0,0,0,0.6)",

	// Shadows
	shadowColor: "#000000",
};

//Ember red / clay orange / slate on charcoal
export const emberTheme: Theme = {
	// Core — lifted from #E24A4A so it clears 4.5:1 as text on dark cards
	primary: "#F06A68",
	background: "#121418",
	cardBg: "#1C1E23",
	cardBgAlt: "#262930",

	// Text
	text: "#ECE7E6",
	textMuted: "#A9B2C2",
	textSecondary: "#DCC8C6",
	textTertiary: "#7F8797",
	textQuaternary: "#3A3E47",
	textInverse: "#121418",

	// Auth
	authBackground: "#121418",
	authCardBg: "#1C1E23",
	authCardBorder: "#2F323A",
	authText: "#ECE7E6",
	authTextMuted: "#A9B2C2",
	authTextHint: "#7F8797",
	authInputBg: "#121418",
	authInputBorder: "#3A3E47",
	authInputText: "#ECE7E6",
	authLabel: "#DCC8C6",

	// Inputs
	inputBg: "#121418",
	inputBorder: "#3A3E47",
	inputPlaceholder: "#7F8797",

	// Borders
	border: "#2F323A",
	borderLight: "#262930",

	// Semantic
	error: "#FFB4AB",
	accent: "#D97757", // clay — celebration moments only
	dotActive: "#F06A68",

	// Macros (nutrition rings/bars) — clay / honey / slate blue
	macroProtein: "#E8896A",
	macroCarbs: "#E9C46A",
	macroFat: "#9FB4D8",

	// Overlays
	overlay: "rgba(0,0,0,0.6)",

	// Shadows
	shadowColor: "#000000",
};

export type Theme = typeof sageTheme; //creates a type of Theme, must contain primary/backgreound etc.

//so this is a string type, but where it's only allowed to be these strings here
export type ThemeName = "sage" | "honey" | "ember";

//Combine theme name w/ theme
//Think of zip in python
export const themes: Record<ThemeName, Theme> = {
	sage: sageTheme,
	honey: honeyTheme,
	ember: emberTheme,
};

// Display label for each theme
export const themeLabels: Record<ThemeName, string> = {
	sage: "Sage",
	honey: "Honey",
	ember: "Ember",
};

// Default theme — used wherever the app initializes its theme state.
// A saved theme that no longer exists (older builds had hearty/sorbet/lavender/midnight) falls back to this.
export const defaultThemeName: ThemeName = "sage";
