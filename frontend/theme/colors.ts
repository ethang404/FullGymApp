//Red/black
export const kratosRedTheme = {
	// Core
	primary: "#D72638",
	background: "#0A0A0A",
	cardBg: "#141414",
	cardBgAlt: "#1C1C1C",

	// Text
	text: "#F5F5F5",
	textMuted: "#A0A0A0",
	textSecondary: "#C0C0C0",
	textTertiary: "#707070",
	textQuaternary: "#505050",
	textInverse: "#0A0A0A",

	// Auth
	authBackground: "#050505",
	authCardBg: "#111111",
	authCardBorder: "#1F1F1F",
	authText: "#F5F5F5",
	authTextMuted: "#A0A0A0",
	authTextHint: "#606060",
	authInputBg: "#0A0A0A",
	authInputBorder: "#2A2A2A",
	authInputText: "#E5E5E5",
	authLabel: "#C0C0C0",

	// Inputs
	inputBg: "#1A1A1A",
	inputBorder: "#2A2A2A",
	inputPlaceholder: "#606060",

	// Borders
	border: "#2A2A2A",
	borderLight: "#333333",

	// Semantic
	error: "#FF4444",
	accent: "#D72638",
	dotActive: "#D72638",

	// Shadows
	shadowColor: "#000000",
};

//White/Black
export const midnightTheme = {
	// Core
	primary: "#FFFFFF",
	background: "#000000",
	cardBg: "#0F0F0F",
	cardBgAlt: "#1A1A1A",

	// Text
	text: "#FFFFFF",
	textMuted: "#999999",
	textSecondary: "#CCCCCC",
	textTertiary: "#666666",
	textQuaternary: "#444444",
	textInverse: "#000000",

	// Auth
	authBackground: "#000000",
	authCardBg: "#0F0F0F",
	authCardBorder: "#222222",
	authText: "#FFFFFF",
	authTextMuted: "#999999",
	authTextHint: "#555555",
	authInputBg: "#000000",
	authInputBorder: "#2A2A2A",
	authInputText: "#FFFFFF",
	authLabel: "#CCCCCC",

	// Inputs
	inputBg: "#111111",
	inputBorder: "#2A2A2A",
	inputPlaceholder: "#555555",

	// Borders
	border: "#222222",
	borderLight: "#2F2F2F",

	// Semantic
	error: "#FF4444",
	accent: "#FFFFFF",
	dotActive: "#FFFFFF",

	// Shadows
	shadowColor: "#000000",
};

//Red/white
export const crimsonLightTheme = {
	// Core
	primary: "#D72638",
	background: "#F7F7F5",
	cardBg: "#FFFFFF",
	cardBgAlt: "#F0EEEA",

	// Text
	text: "#111111",
	textMuted: "#666666",
	textSecondary: "#444444",
	textTertiary: "#888888",
	textQuaternary: "#AAAAAA",
	textInverse: "#FFFFFF",

	// Auth
	authBackground: "#0f172a",
	authCardBg: "#111827",
	authCardBorder: "#1f2937",
	authText: "#f9fafb",
	authTextMuted: "#9ca3af",
	authTextHint: "#6b7280",
	authInputBg: "#020617",
	authInputBorder: "#1f2937",
	authInputText: "#e5e7eb",
	authLabel: "#d1d5db",

	// Inputs
	inputBg: "#FFFFFF",
	inputBorder: "#DDDDDD",
	inputPlaceholder: "#AAAAAA",

	// Borders
	border: "#E0DDDA",
	borderLight: "#EEEBE8",

	// Semantic
	error: "#D72638",
	accent: "#D72638",
	dotActive: "#D72638",

	// Shadows
	shadowColor: "#000000",
};

//Black/orange
export const carbonTheme = {
	// Core
	primary: "#F97316",
	background: "#111111",
	cardBg: "#1C1C1C",
	cardBgAlt: "#242424",

	// Text
	text: "#F0F0F0",
	textMuted: "#909090",
	textSecondary: "#B0B0B0",
	textTertiary: "#606060",
	textQuaternary: "#484848",
	textInverse: "#111111",

	// Auth
	authBackground: "#0A0A0A",
	authCardBg: "#141414",
	authCardBorder: "#222222",
	authText: "#F0F0F0",
	authTextMuted: "#909090",
	authTextHint: "#555555",
	authInputBg: "#0A0A0A",
	authInputBorder: "#2A2A2A",
	authInputText: "#E0E0E0",
	authLabel: "#B0B0B0",

	// Inputs
	inputBg: "#1C1C1C",
	inputBorder: "#2E2E2E",
	inputPlaceholder: "#585858",

	// Borders
	border: "#2A2A2A",
	borderLight: "#333333",

	// Semantic
	error: "#FF4444",
	accent: "#F97316",
	dotActive: "#F97316",

	// Shadows
	shadowColor: "#000000",
};

//Blue/Black
export const slateTheme = {
	// Core
	primary: "#3B82F6",
	background: "#0F172A",
	cardBg: "#1E293B",
	cardBgAlt: "#263347",

	// Text
	text: "#F1F5F9",
	textMuted: "#94A3B8",
	textSecondary: "#CBD5E1",
	textTertiary: "#64748B",
	textQuaternary: "#475569",
	textInverse: "#0F172A",

	// Auth
	authBackground: "#020617",
	authCardBg: "#0F172A",
	authCardBorder: "#1E293B",
	authText: "#F1F5F9",
	authTextMuted: "#94A3B8",
	authTextHint: "#64748B",
	authInputBg: "#020617",
	authInputBorder: "#1E293B",
	authInputText: "#E2E8F0",
	authLabel: "#CBD5E1",

	// Inputs
	inputBg: "#1E293B",
	inputBorder: "#334155",
	inputPlaceholder: "#64748B",

	// Borders
	border: "#1E293B",
	borderLight: "#334155",

	// Semantic
	error: "#F87171",
	accent: "#3B82F6",
	dotActive: "#3B82F6",

	// Shadows
	shadowColor: "#000000",
};

export type Theme = typeof kratosRedTheme; //creates a type of Theme, must contain primary/backgreound etc.

//so this is a string type, but where it's only allowed to be these strings here
export type ThemeName = "kratosRed" | "midnight" | "crimsonLight" | "carbon" | "slate";

//Combine theme name w/ theme
//Think of zip in python
export const themes: Record<ThemeName, Theme> = {
	kratosRed: kratosRedTheme,
	midnight: midnightTheme,
	crimsonLight: crimsonLightTheme,
	carbon: carbonTheme,
	slate: slateTheme,
};
