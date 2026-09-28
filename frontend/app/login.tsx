import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useTheme } from "@/theme/ThemeProvider";
import Screen from "@/components/Screen";
import AppleSignInButton from "@/components/AppleSignInButton";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { authInstance } from "../utils/AxiosInterceptorHandler";
import { fonts, APP_NAME } from "@/theme/typography";

export default function Login() {
	const { theme } = useTheme();
	const [userName, setUserName] = useState("");
	const [password, setPassword] = useState("");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [mode, setMode] = useState<"login" | "register">("login"); //determins if I do login or register
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [guestLoading, setGuestLoading] = useState(false);

	async function handleGuest() {
		setGuestLoading(true);
		setError(null);

		try {
			await authInstance.post("/auth/guest");
		} catch (err) {
			setError("Couldn't start a guest session. Check your connection and try again.");
		} finally {
			setGuestLoading(false);
		}
	}

	async function handleAuth() {
		setLoading(true);
		setError(null);

		try {
			if (!userName || !password) {
				setError("Enter your username and password.");
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
					setError("Enter your first and last name.");
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
		} catch (err: any) {
			if (!err?.response) setError("Couldn't reach the server. Check your connection and try again.");
			else setError(mode === "login" ? "That username and password don't match. Try again." : "Couldn't create your account. Try a different username.");
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
					fontSize: 40,
					lineHeight: 46,
					fontFamily: fonts.headingHeavy,
					color: theme.primary,
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
					color: theme.textInverse,
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
				guestButton: {
					alignItems: "center",
					marginTop: 14,
					paddingVertical: 8,
				},
				guestButtonText: {
					color: theme.authTextMuted,
					fontSize: 13,
					fontWeight: "600",
					textDecorationLine: "underline",
				},
				dividerRow: {
					flexDirection: "row",
					alignItems: "center",
					marginTop: 18,
					marginBottom: 14,
				},
				dividerLine: {
					flex: 1,
					height: 1,
					backgroundColor: theme.authCardBorder,
				},
				dividerText: {
					color: theme.authTextHint,
					fontSize: 12,
					marginHorizontal: 10,
				},
				oauthRow: {
					gap: 10,
				},
			}),
		[theme],
	);

	return (
		<Screen edges={["top", "bottom"]} background={theme.authBackground}>
			<KeyboardAwareScrollView style={{ flex: 1 }} contentContainerStyle={styles.container} enableOnAndroid extraScrollHeight={40} keyboardShouldPersistTaps="handled">
			<View style={styles.card}>
				<Text style={styles.title}>{APP_NAME}</Text>
				<Text style={styles.subtitle}>Track what you eat and how you train, all in one place.</Text>
				<Text style={styles.helperText}>{mode === "login" ? "Welcome back." : "It takes about a minute."}</Text>

				<View style={styles.switchRow}>
					<TouchableOpacity
						style={[styles.switchButton, mode === "login" && styles.switchButtonActive]}
						onPress={() => setMode("login")}
						accessibilityRole="tab"
						accessibilityState={{ selected: mode === "login" }}
					>
						<Text style={[styles.switchText, mode === "login" && styles.switchTextActive]}>Log in</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.switchButton, mode === "register" && styles.switchButtonActive]}
						onPress={() => setMode("register")}
						accessibilityRole="tab"
						accessibilityState={{ selected: mode === "register" }}
					>
						<Text style={[styles.switchText, mode === "register" && styles.switchTextActive]}>Create account</Text>
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
				<TextInput style={styles.input} placeholder={mode === "login" ? "Your username" : "Choose a username"} value={userName} onChangeText={setUserName} autoCapitalize="none" autoCorrect={false} />
				{mode === "register" ? <Text style={styles.fieldHint}>You&apos;ll use this to log in.</Text> : null}

				<Text style={styles.label}>Password</Text>
				<TextInput
					style={styles.input}
					placeholder={mode === "login" ? "Your password" : "Create a password"}
					value={password}
					onChangeText={setPassword}
					secureTextEntry
				/>

				{error && <Text style={styles.error}>{error}</Text>}

				<TouchableOpacity style={[styles.primaryButton, loading && styles.primaryButtonDisabled]} onPress={handleAuth} disabled={loading || guestLoading}>
					{loading ? <ActivityIndicator color={theme.textInverse} /> : <Text style={styles.primaryButtonText}>{mode === "login" ? "Log in" : "Create account"}</Text>}
				</TouchableOpacity>

				<TouchableOpacity style={styles.guestButton} onPress={handleGuest} disabled={loading || guestLoading}>
					{guestLoading ? <ActivityIndicator color={theme.authTextMuted} /> : <Text style={styles.guestButtonText}>Try it without an account</Text>}
				</TouchableOpacity>

				<View style={styles.dividerRow}>
					<View style={styles.dividerLine} />
					<Text style={styles.dividerText}>or</Text>
					<View style={styles.dividerLine} />
				</View>

				<View style={styles.oauthRow}>
					<AppleSignInButton onError={setError} disabled={loading || guestLoading} />
					<GoogleAuthButton onError={setError} disabled={loading || guestLoading} />
				</View>
			</View>
			</KeyboardAwareScrollView>
		</Screen>
	);
}
