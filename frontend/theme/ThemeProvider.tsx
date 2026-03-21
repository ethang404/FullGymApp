import React, { createContext, useContext, useState, type PropsWithChildren, useEffect } from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { themes, type Theme, type ThemeName } from "./colors";

interface themeContextType {
	name: ThemeName; //really just a string constrained to specific values
	theme: Theme;
	setTheme: (themeName: ThemeName) => void;
}

const ThemeContext = createContext<themeContextType>({
	//default values here
	name: "kratosRed",
	theme: themes.kratosRed,
	setTheme: () => {},
});

export function ThemeProvider({ children }: PropsWithChildren) {
	const [name, setName] = useState<ThemeName>("kratosRed"); //set theme name here

	const theme = themes[name];

	async function setTheme(themeName: ThemeName) {
		setName(themeName);
	}

	return <ThemeContext value={{ name, theme, setTheme }}>{children}</ThemeContext>;
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
