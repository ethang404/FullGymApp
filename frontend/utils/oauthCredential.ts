// What the Google/Apple buttons hand back when a parent passes onCredential,
// shaped to match what POST /auth/upgrade-guest/oauth expects.
export type OAuthCredential =
	| { provider: "google"; idToken: string }
	| { provider: "apple"; identityToken: string; nonce: string; firstName: string | null; lastName: string | null };
