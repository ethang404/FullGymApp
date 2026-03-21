import React, { useContext, useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import * as SecureStore from "expo-secure-store";
import { AuthContext } from "../utils/AuthProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { instance, authInstance } from "../utils/AxiosInterceptorHandler";

export default function Login() {
	const { theme } = useTheme();
	const { signIn, isValidUser } = useContext(AuthContext);
	const [userName, setUserName] = useState("");
	const [password, setPassword] = useState("");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [mode, setMode] = useState<"login" | "register">("login"); //determins if I do login or register
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	// On init see if user is valid.
	useEffect(() => {
		async function verifyToken() {
			const accessToken = await SecureStore.getItemAsync("accessToken");
			if (!accessToken) return;

			try {
				await instance.get("/auth/validToken");
				signIn();
			} catch {
				// token invalid or expired, stay on login
			}
		}
		verifyToken();
	}, [signIn]);

	async function handleAuth() {
		setLoading(true);
		setError(null);

		try {
			if (!userName || !password) {
				setError("Please enter a username and password");
				return;
			}

			if (mode === "login") {
				const loginPayload = {
					userName,
					password,
				};
				await authInstance.post("/auth/login", loginPayload);
			} else {
				if (!firstName || !lastName) {
					setError("Please enter your first and last name");
					return;
				}

				const registerPayload = {
					firstName,
					lastName,
					userName,
					password,
				};
				await authInstance.post("/auth/register", registerPayload);
			}
		} catch (err) {
			setError(mode === "login" ? "Login failed. Check your credentials." : "Registration failed.");
		} finally {
			setLoading(false);
		}
	}

	//This is very cool
	//You use useMemo to avoid re-renders!
	//Because we use theme inherited in this function, this stylesheet is re-created each time display changes (typing). Expensive operation.
	//useMemo hook only re-creates when theme changes.
	const styles = useMemo(
		() =>
			StyleSheet.create({
				container: {
					flex: 1,
					justifyContent: "center",
					alignItems: "center",
					backgroundColor: theme.authBackground,
					paddingHorizontal: 16,
				},
				card: {
					width: "100%",
					maxWidth: 380,
					backgroundColor: theme.authCardBg,
					borderRadius: 24,
					padding: 24,
					borderWidth: 1,
					borderColor: theme.authCardBorder,
				},
				title: {
					fontSize: 28,
					fontWeight: "700",
					color: theme.authText,
					marginBottom: 4,
					textAlign: "center",
				},
				subtitle: {
					fontSize: 14,
					color: theme.authTextMuted,
					marginBottom: 6,
					textAlign: "center",
				},
				helperText: {
					fontSize: 12,
					color: theme.authTextHint,
					textAlign: "center",
					marginBottom: 16,
				},
				switchRow: {
					flexDirection: "row",
					backgroundColor: theme.authInputBg,
					borderRadius: 999,
					padding: 4,
					marginBottom: 20,
				},
				switchButton: {
					flex: 1,
					alignItems: "center",
					borderRadius: 999,
					paddingVertical: 8,
				},
				switchButtonActive: {
					backgroundColor: theme.primary,
				},
				switchText: {
					fontSize: 14,
					color: theme.authTextMuted,
				},
				switchTextActive: {
					color: theme.authText,
					fontWeight: "600",
				},
				label: {
					fontSize: 13,
					color: theme.authLabel,
					marginBottom: 4,
					marginTop: 6,
				},
				input: {
					backgroundColor: theme.authInputBg,
					borderRadius: 12,
					paddingHorizontal: 12,
					paddingVertical: 10,
					color: theme.authInputText,
					borderWidth: 1,
					borderColor: theme.authInputBorder,
					marginBottom: 10,
				},
				fieldHint: {
					fontSize: 11,
					color: theme.authTextHint,
					marginBottom: 6,
				},
				error: {
					color: theme.error,
					fontSize: 13,
					marginBottom: 10,
				},
				primaryButton: {
					backgroundColor: theme.primary,
					borderRadius: 12,
					paddingVertical: 12,
					alignItems: "center",
					marginTop: 4,
				},
				primaryButtonDisabled: {
					opacity: 0.7,
				},
				primaryButtonText: {
					color: theme.textInverse,
					fontSize: 16,
					fontWeight: "600",
				},
				alreadyText: {
					color: theme.authTextMuted,
					fontSize: 12,
					marginTop: 10,
					textAlign: "center",
				},
			}),
		[theme],
	);

	return (
		<KeyboardAwareScrollView contentContainerStyle={styles.container} enableOnAndroid extraScrollHeight={40} keyboardShouldPersistTaps="handled">
			<View style={styles.card}>
				<Text style={styles.title}>Kratos</Text>
				<Text style={styles.subtitle}>{mode === "login" ? "Sign in to your account" : "Create a new account"}</Text>
				<Text style={styles.helperText}>Use a unique username and a strong password. We will use your name to personalize your dashboard.</Text>

				<View style={styles.switchRow}>
					<TouchableOpacity style={[styles.switchButton, mode === "login" && styles.switchButtonActive]} onPress={() => setMode("login")}>
						<Text style={[styles.switchText, mode === "login" && styles.switchTextActive]}>Login</Text>
					</TouchableOpacity>
					<TouchableOpacity style={[styles.switchButton, mode === "register" && styles.switchButtonActive]} onPress={() => setMode("register")}>
						<Text style={[styles.switchText, mode === "register" && styles.switchTextActive]}>Register</Text>
					</TouchableOpacity>
				</View>

				{mode === "register" && (
					<>
						<Text style={styles.label}>First name</Text>
						<TextInput style={styles.input} placeholder="e.g. Alex" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
						<Text style={styles.label}>Last name</Text>
						<TextInput style={styles.input} placeholder="e.g. Mercer" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
					</>
				)}

				<Text style={styles.label}>Username</Text>
				<TextInput style={styles.input} placeholder="Choose a username" value={userName} onChangeText={setUserName} autoCapitalize="none" autoCorrect={false} />
				<Text style={styles.fieldHint}>This is what you will use to log in.</Text>

				<Text style={styles.label}>Password</Text>
				<TextInput
					style={styles.input}
					placeholder={mode === "login" ? "Enter your password" : "Create a strong password"}
					value={password}
					onChangeText={setPassword}
					secureTextEntry
				/>

				{error && <Text style={styles.error}>{error}</Text>}

				<TouchableOpacity style={[styles.primaryButton, loading && styles.primaryButtonDisabled]} onPress={handleAuth} disabled={loading}>
					{loading ? <ActivityIndicator color={theme.textInverse} /> : <Text style={styles.primaryButtonText}>{mode === "login" ? "Sign In" : "Sign Up"}</Text>}
				</TouchableOpacity>
			</View>
		</KeyboardAwareScrollView>
	);
}
