import { Redirect } from "expo-router";
import { useContext } from "react";
import { AuthContext } from "@/utils/AuthProvider";

//apparently needed to be explicit for build so it knows where to go by default
export default function Index() {
	const { isValidUser } = useContext(AuthContext);
	return <Redirect href={isValidUser ? "/(protected)/Home" : "/login"} />;
}
