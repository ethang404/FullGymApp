import React, { createContext, useContext, useState, useEffect, type PropsWithChildren } from "react";
import * as SecureStore from "expo-secure-store";
import { themes, type Theme, type ThemeName } from "./colors";

const THEME_KEY = "app_theme";

interface ThemeContextType {
	name: ThemeName;
	theme: Theme;
	setTheme: (themeName: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
	const [name, setName] = useState<ThemeName>("kratosRed");

	// Load persisted theme on mount
	useEffect(() => {
		SecureStore.getItemAsync(THEME_KEY).then((saved) => {
			if (saved && saved in themes) {
				setName(saved as ThemeName);
			}
		});
	}, []);

	async function setTheme(themeName: ThemeName) {
		setName(themeName);
		await SecureStore.setItemAsync(THEME_KEY, themeName);
	}

	return (
		<ThemeContext value={{ name, theme: themes[name], setTheme }}>
			{children}
		</ThemeContext>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) throw new Error("useTheme must be used within a ThemeProvider");
	return context;
}
