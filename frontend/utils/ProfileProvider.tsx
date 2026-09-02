import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, type PropsWithChildren } from "react";
import { instance } from "./AxiosInterceptorHandler";
import { AuthContext } from "./AuthProvider";
import { GOAL_DEFAULTS, type MacroGoals, type Sex, type ActivityLevel, type GoalType } from "./macroDefaults";
import { log } from "./log";

// Reference-stable fallback so the context value's identity doesn't churn when
// there's no profile yet.
const DEFAULT_GOALS: MacroGoals = { ...GOAL_DEFAULTS };

export interface UserBody {
	sex: Sex | null;
	birth_date: string | null;
	height_cm: number | string | null;
	weight_kg: number | string | null;
	activity_level: ActivityLevel | null;
	goal_type: GoalType | null;
}

export interface UserProfile {
	user_id: number;
	first_name: string | null;
	last_name: string | null;
	user_name: string;
	created_at: string;
	onboarding_completed: boolean;
	body: UserBody;
	goals: Record<keyof MacroGoals, number | null>;
	effective_goals: MacroGoals;
}

export interface ProfilePatch {
	first_name?: string;
	last_name?: string;
	sex?: Sex | null;
	birth_date?: string | null;
	height_cm?: number | null;
	weight_kg?: number | null;
	activity_level?: ActivityLevel | null;
	goal_type?: GoalType | null;
	goals?: Partial<Record<keyof MacroGoals, number | null>>;
	onboarding_completed?: boolean;
}

export interface EstimateResult {
	bmr: number;
	tdee: number;
	goals: MacroGoals;
}

interface ProfileContextType {
	profile: UserProfile | null;
	goals: MacroGoals;
	loading: boolean;
	refresh: () => Promise<void>;
	updateProfile: (patch: ProfilePatch) => Promise<UserProfile>;
	estimateGoals: (body: EstimateBody) => Promise<EstimateResult>;
}

export type EstimateBody = {
	sex: Sex;
	birth_date: string;
	height_cm: number;
	weight_kg: number;
	activity_level: ActivityLevel;
	goal_type: GoalType;
};

const ProfileContext = createContext<ProfileContextType>({
	profile: null,
	goals: DEFAULT_GOALS,
	loading: true,
	refresh: async () => {},
	updateProfile: async () => {
		throw new Error("ProfileProvider not mounted");
	},
	estimateGoals: async () => {
		throw new Error("ProfileProvider not mounted");
	},
});

export function ProfileProvider({ children }: PropsWithChildren) {
	const { isValidUser } = useContext(AuthContext);
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		if (!isValidUser) {
			setProfile(null);
			setLoading(false);
			return;
		}
		setLoading(true);
		// One retry: right after sign-in the freshly stored token can briefly lag
		// behind (SecureStore write visibility), so a first 401 is worth retrying.
		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				const res = await instance.get("/users/me");
				setProfile(res.data.user);
				setLoading(false);
				return;
			} catch (e) {
				if (attempt === 1) {
					log.error("Failed to load profile:", e);
					setProfile(null);
					setLoading(false);
				} else {
					await new Promise((r) => setTimeout(r, 400));
				}
			}
		}
	}, [isValidUser]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const updateProfile = useCallback(async (patch: ProfilePatch) => {
		const res = await instance.patch("/users/me", patch);
		setProfile(res.data.user);
		return res.data.user as UserProfile;
	}, []);

	const estimateGoals = useCallback(async (body: EstimateBody) => {
		const res = await instance.post("/users/me/goals/estimate", body);
		return res.data.estimate as EstimateResult;
	}, []);

	const goals: MacroGoals = profile?.effective_goals ?? DEFAULT_GOALS;

	const value = useMemo(
		() => ({ profile, goals, loading, refresh, updateProfile, estimateGoals }),
		[profile, goals, loading, refresh, updateProfile, estimateGoals],
	);

	return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
	return useContext(ProfileContext);
}
