import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type PropsWithChildren } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { _setToastHandler, type ToastType } from "./toast";

const VISIBLE_MS = 3200;
const ENTER_MS = 220;
const EXIT_MS = 160;

interface ToastContextType {
	show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastState {
	id: number;
	message: string;
	type: ToastType;
}

type IconName = ComponentProps<typeof FontAwesome5>["name"];

const ICONS: Record<ToastType, IconName> = {
	success: "check-circle",
	error: "exclamation-circle",
	info: "info-circle",
};

export function ToastProvider({ children }: PropsWithChildren) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const [toast, setToast] = useState<ToastState | null>(null);
	// useState (not useRef) so the value can be read during render without tripping
	// the rules-of-hooks "no refs during render" check.
	const [anim] = useState(() => new Animated.Value(0));
	const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const dismiss = useCallback(() => {
		if (hideTimer.current) clearTimeout(hideTimer.current);
		hideTimer.current = null;
		Animated.timing(anim, { toValue: 0, duration: EXIT_MS, useNativeDriver: true }).start(({ finished }) => {
			if (finished) setToast(null);
		});
	}, [anim]);

	const show = useCallback(
		(message: string, type: ToastType = "error") => {
			if (!message) return;
			if (hideTimer.current) clearTimeout(hideTimer.current);
			setToast({ id: Date.now(), message, type });
			anim.setValue(0);
			Animated.timing(anim, { toValue: 1, duration: ENTER_MS, useNativeDriver: true }).start();
			hideTimer.current = setTimeout(dismiss, VISIBLE_MS);
		},
		[anim, dismiss],
	);

	useEffect(() => {
		_setToastHandler((message, type) => show(message, type));
		return () => {
			_setToastHandler(null);
			if (hideTimer.current) clearTimeout(hideTimer.current);
		};
	}, [show]);

	const value = useMemo(() => ({ show }), [show]);

	const accent =
		toast?.type === "success" ? theme.macroProtein : toast?.type === "info" ? theme.primary : theme.error;

	return (
		<ToastContext.Provider value={value}>
			{children}
			{toast && (
				<View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
					<Animated.View
						style={{
							opacity: anim,
							transform: [
								{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
							],
						}}
					>
						<Pressable
							onPress={dismiss}
							accessibilityRole="alert"
							style={[styles.pill, { backgroundColor: accent }]}
						>
							<FontAwesome5 name={ICONS[toast.type]} size={14} color={theme.textInverse} />
							<Text style={[styles.text, { color: theme.textInverse }]} numberOfLines={3}>
								{toast.message}
							</Text>
						</Pressable>
					</Animated.View>
				</View>
			)}
		</ToastContext.Provider>
	);
}

export function useToast() {
	const ctx = useContext(ToastContext);
	if (!ctx) throw new Error("useToast must be used within a ToastProvider");
	return ctx;
}

const styles = StyleSheet.create({
	host: {
		position: "absolute",
		left: 16,
		right: 16,
		alignItems: "center",
		zIndex: 9999,
		elevation: 9999,
	},
	pill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		maxWidth: 480,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 12,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.2,
		shadowRadius: 12,
	},
	text: {
		flexShrink: 1,
		fontSize: 13.5,
		fontWeight: "600",
	},
});
