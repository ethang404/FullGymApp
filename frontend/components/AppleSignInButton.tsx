import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { useTheme } from "@/theme/ThemeProvider";
import { authInstance } from "../utils/AxiosInterceptorHandler";
import { isDarkColor } from "../utils/colorContrast";
import { log } from "../utils/log";
import type { OAuthCredential } from "../utils/oauthCredential";

type AppleSignInButtonProps = {
	// Surfaced by the parent screen (e.g. rendered next to the existing error text in login.tsx).
	onError?: (message: string) => void;
	disabled?: boolean;
	// When passed, the button hands the credential to the parent instead of logging in
	// (e.g. the guest upgrade modal). The parent owns the request and its errors.
	onCredential?: (credential: OAuthCredential) => Promise<void>;
};

export default function AppleSignInButton({ onError, disabled, onCredential }: AppleSignInButtonProps) {
	const { theme } = useTheme();
	const [available, setAvailable] = useState(false);

	useEffect(() => {
		if (Platform.OS !== "ios") return;
		AppleAuthentication.isAvailableAsync().then(setAvailable);
	}, []);

	if (Platform.OS !== "ios" || !available) return null;

	async function handlePress() {
		try {
			// Nonce round-trip so the backend can bind the identityToken it verifies
			// to this specific sign-in attempt (Apple's replay-protection pattern).
			const rawNonce = Crypto.randomUUID();
			const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

			const credential = await AppleAuthentication.signInAsync({
				requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
				nonce: hashedNonce,
			});

			if (!credential.identityToken) {
				onError?.("Apple didn't return a valid credential. Please try again.");
				return;
			}

			if (onCredential) {
				// Raw nonce goes to the backend, which hashes it and compares against the token's.
				// Parent handles its own errors, so don't let them fall into the catch below.
				const credentialBody: OAuthCredential = {
					provider: "apple",
					identityToken: credential.identityToken,
					nonce: rawNonce,
					firstName: credential.fullName?.givenName ?? null,
					lastName: credential.fullName?.familyName ?? null,
				};
				await onCredential(credentialBody).catch(() => {});
				return;
			}

			// Backend verifies identityToken (sig/aud/iss/exp + nonce) and logs in or creates the user.
			await authInstance.post("/auth/apple", {
				identityToken: credential.identityToken,
				authorizationCode: credential.authorizationCode,
				nonce: rawNonce,
				appleUserId: credential.user,
				firstName: credential.fullName?.givenName ?? null,
				lastName: credential.fullName?.familyName ?? null,
				email: credential.email ?? null,
			});
		} catch (err: any) {
			if (err?.code === "ERR_REQUEST_CANCELED") {
				return;
			}
			log.warn("Apple sign-in failed", err);
			onError?.("Apple sign-in failed. Please try again.");
		}
	}

	return (
		<View pointerEvents={disabled ? "none" : "auto"} style={disabled ? { opacity: 0.6 } : undefined}>
			<AppleAuthentication.AppleAuthenticationButton
				buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
				buttonStyle={
					isDarkColor(theme.authCardBg) ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
				}
				cornerRadius={12}
				style={{ height: 48, width: "100%" }}
				onPress={handlePress}
			/>
		</View>
	);
}
