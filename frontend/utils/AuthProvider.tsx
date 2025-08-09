import React, { createContext, useState, ReactNode, type PropsWithChildren } from "react";

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
