import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { GoogleOneTapSignIn, GoogleSignInButton, isErrorWithCode, statusCodes, type OneTapSuccessData } from "react-native-nitro-google-signin";
import { useTheme } from "@/theme/ThemeProvider";
import { authInstance } from "../utils/AxiosInterceptorHandler";
import { isDarkColor } from "../utils/colorContrast";
import { log } from "../utils/log";

let configured = false;

// configure() is cheap to call again, but only needs to happen once per app session.
function ensureConfigured() {
	if (configured) return;
	configured = true;
	GoogleOneTapSignIn.configure({
		webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
		iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
	});
}

type GoogleAuthButtonProps = {
	// Surfaced by the parent screen (e.g. rendered next to the existing error text in login.tsx).
	onError?: (message: string) => void;
	disabled?: boolean;
};

export default function GoogleAuthButton({ onError, disabled }: GoogleAuthButtonProps) {
	const { theme } = useTheme();

	useEffect(() => {
		ensureConfigured();
	}, []);

	async function handleSuccess(data: OneTapSuccessData) {
		try {
			// Backend verifies idToken (sig/aud/iss/exp) and logs in or creates the user.
			await authInstance.post("/auth/google", {
				idToken: data.idToken,
				googleUserId: data.user.id,
				firstName: data.user.givenName,
				lastName: data.user.familyName,
				email: data.user.email,
			});
		} catch (err) {
			log.warn("Backend rejected Google sign-in", err);
			onError?.("Google sign-in failed. Please try again.");
		}
	}

	function handleSignInError(err: unknown) {
		if (isErrorWithCode(err) && err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
			onError?.("Google Play Services is required to continue.");
			return;
		}
		log.warn("Google sign-in failed", err);
		onError?.("Google sign-in failed. Please try again.");
	}

	return (
		<View pointerEvents={disabled ? "none" : "auto"} style={disabled ? styles.disabled : undefined}>
			<GoogleSignInButton
				signInBehavior="credentialManager"
				colorScheme={isDarkColor(theme.authCardBg) ? "dark" : "light"}
				size="wide"
				disabled={disabled ?? false}
				style={styles.button}
				onSignInSuccess={handleSuccess}
				onSignInError={handleSignInError}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	button: { width: "100%", height: 48 },
	disabled: { opacity: 0.6 },
});
