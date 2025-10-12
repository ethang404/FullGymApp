import React, {
	createContext,
	useState,
	ReactNode,
	type PropsWithChildren,
	useEffect,
} from "react";

export const AuthContext = createContext<{
	signIn: () => void;
	signOut: () => void;
	isValidUser: boolean;
}>({
	signIn: () => null,
	signOut: () => null,
	isValidUser: false,
});

export function AuthProvider({ children }: PropsWithChildren) {
	const [isValidUser, setValidUser] = useState(false);

	/*useEffect(() => {
		async function verifyToken() {
			//get accessToken from expo secure store here--
			let authToken = await SecureStore.getItemAsync("accessToken");
			if (!authToken) return;

			let resp = await axios.get(`${process.env.EXPO_PUBLIC_BACKEND_URL}/auth/validToken`, {
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
					"Custom-Header": "My-Custom-Value",
				},
			});
			if (resp.status) {
				console.log("User is valid! YAY!");
				setValidUser(true);
			} else console.log("User is SUS!");
		}
		verifyToken();
	}, []);*/

	return (
		<AuthContext.Provider
			value={{
				signIn: () => {
					// Perform sign-in logic here
					setValidUser(true);
				},
				signOut: () => {
					setValidUser(false);
				},
				isValidUser,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}
