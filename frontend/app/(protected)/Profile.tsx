import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useContext, useMemo } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { themes, themeLabels, type ThemeName } from "@/theme/colors";
import { AuthContext } from "@/utils/AuthProvider";

// ─── Theme options ─────────────────────────────────────────────────────────────
// Derived from the theme registry itself so every theme added to theme/colors.ts
// automatically shows up here with its real swatch colors.

const THEME_OPTIONS: { name: ThemeName; label: string; primary: string; bg: string }[] = (
	Object.keys(themes) as ThemeName[]
).map((name) => ({
	name,
	label: themeLabels[name],
	primary: themes[name].primary,
	bg: themes[name].background,
}));

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function Profile() {
	const { theme, name: activeName, setTheme } = useTheme();
	const { signOut } = useContext(AuthContext);

	const styles = useMemo(
		() =>
			StyleSheet.create({
				safe: { flex: 1, backgroundColor: theme.background },
				scroll: { flex: 1 },
				content: { paddingBottom: 40 },

				// Page header
				pageHeader: {
					paddingHorizontal: 20,
					paddingTop: 20,
					paddingBottom: 24,
				},
				pageTitle: {
					fontSize: 22,
					fontWeight: "800",
					color: theme.text,
				},

				// Avatar area
				avatarSection: {
					alignItems: "center",
					paddingVertical: 24,
					gap: 10,
				},
				avatar: {
					width: 72,
					height: 72,
					borderRadius: 36,
					backgroundColor: theme.cardBgAlt,
					alignItems: "center",
					justifyContent: "center",
					borderWidth: 2,
					borderColor: theme.primary,
				},
				userName: {
					fontSize: 20,
					fontWeight: "800",
					color: theme.text,
				},
				userSub: {
					fontSize: 13,
					color: theme.textMuted,
				},

				// Section label
				sectionLabel: {
					fontSize: 11,
					fontWeight: "700",
					color: theme.textMuted,
					letterSpacing: 1.5,
					textTransform: "uppercase",
					paddingHorizontal: 20,
					marginBottom: 8,
					marginTop: 24,
				},

				// Settings group
				group: {
					marginHorizontal: 16,
					backgroundColor: theme.cardBg,
					borderRadius: 16,
					borderWidth: 1,
					borderColor: theme.border,
					overflow: "hidden",
				},
				row: {
					flexDirection: "row",
					alignItems: "center",
					paddingHorizontal: 16,
					paddingVertical: 14,
					borderBottomWidth: 1,
					borderBottomColor: theme.border,
					gap: 14,
				},
				rowLast: {
					borderBottomWidth: 0,
				},
				rowIcon: {
					width: 32,
					height: 32,
					borderRadius: 9,
					backgroundColor: theme.cardBgAlt,
					alignItems: "center",
					justifyContent: "center",
				},
				rowLabel: {
					fontSize: 15,
					fontWeight: "600",
					color: theme.text,
					flex: 1,
				},
				rowValue: {
					fontSize: 14,
					color: theme.textMuted,
					marginRight: 6,
				},

				// Theme picker
				themeGrid: {
					marginHorizontal: 16,
					flexDirection: "row",
					flexWrap: "wrap",
					gap: 10,
				},
				themePill: {
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
					paddingHorizontal: 14,
					paddingVertical: 10,
					borderRadius: 12,
					borderWidth: 1.5,
				},
				themeSwatch: {
					width: 16,
					height: 16,
					borderRadius: 8,
				},
				themePillText: {
					fontSize: 13,
					fontWeight: "600",
				},

				// Danger zone
				dangerRow: {
					marginHorizontal: 16,
					marginTop: 12,
					borderRadius: 14,
					borderWidth: 1,
					borderColor: `${theme.error}40`,
					backgroundColor: `${theme.error}10`,
					paddingHorizontal: 16,
					paddingVertical: 14,
					flexDirection: "row",
					alignItems: "center",
					gap: 12,
				},
				dangerText: {
					fontSize: 15,
					fontWeight: "600",
					color: theme.error,
					flex: 1,
				},
			}),
		[theme],
	);

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				{/* Page title */}
				<View style={styles.pageHeader}>
					<Text style={styles.pageTitle}>Profile</Text>
				</View>

				{/* Avatar */}
				<View style={styles.avatarSection}>
					<View style={styles.avatar}>
						<FontAwesome5 name="user" size={28} color={theme.primary} />
					</View>
					<Text style={styles.userName}>Your Name</Text>
					<Text style={styles.userSub}>Member since 2024</Text>
				</View>

				{/* Preferences */}
				<Text style={styles.sectionLabel}>Preferences</Text>
				<View style={styles.group}>
					<View style={styles.row}>
						<View style={styles.rowIcon}>
							<FontAwesome5 name="ruler" size={13} color={theme.textSecondary} />
						</View>
						<Text style={styles.rowLabel}>Units</Text>
						<Text style={styles.rowValue}>Metric</Text>
						<FontAwesome5 name="chevron-right" size={12} color={theme.textTertiary} />
					</View>
					<View style={[styles.row, styles.rowLast]}>
						<View style={styles.rowIcon}>
							<FontAwesome5 name="bullseye" size={13} color={theme.textSecondary} />
						</View>
						<Text style={styles.rowLabel}>Daily Calorie Goal</Text>
						<Text style={styles.rowValue}>2,400 kcal</Text>
						<FontAwesome5 name="chevron-right" size={12} color={theme.textTertiary} />
					</View>
				</View>

				{/* Theme */}
				<Text style={styles.sectionLabel}>Theme</Text>
				<View style={styles.themeGrid}>
					{THEME_OPTIONS.map((t) => {
						const isActive = activeName === t.name;
						return (
							<TouchableOpacity
								key={t.name}
								style={[
									styles.themePill,
									{
										backgroundColor: isActive ? `${t.primary}20` : theme.cardBg,
										borderColor: isActive ? t.primary : theme.border,
									},
								]}
								onPress={() => setTheme(t.name)}
								activeOpacity={0.7}
							>
								<View
									style={[
										styles.themeSwatch,
										{ backgroundColor: t.primary, borderWidth: 1, borderColor: `${t.primary}60` },
									]}
								/>
								<Text
									style={[
										styles.themePillText,
										{ color: isActive ? t.primary : theme.textSecondary },
									]}
								>
									{t.label}
								</Text>
								{isActive && (
									<FontAwesome5 name="check" size={10} color={t.primary} />
								)}
							</TouchableOpacity>
						);
					})}
				</View>

				{/* Account */}
				<Text style={styles.sectionLabel}>Account</Text>
				<View style={styles.group}>
					<View style={styles.row}>
						<View style={styles.rowIcon}>
							<FontAwesome5 name="bell" size={13} color={theme.textSecondary} />
						</View>
						<Text style={styles.rowLabel}>Notifications</Text>
						<FontAwesome5 name="chevron-right" size={12} color={theme.textTertiary} />
					</View>
					<View style={styles.row}>
						<View style={styles.rowIcon}>
							<FontAwesome5 name="shield-alt" size={13} color={theme.textSecondary} />
						</View>
						<Text style={styles.rowLabel}>Privacy Policy</Text>
						<FontAwesome5 name="external-link-alt" size={11} color={theme.textTertiary} />
					</View>
					<TouchableOpacity style={[styles.row, styles.rowLast]} onPress={signOut} activeOpacity={0.7}>
						<View style={styles.rowIcon}>
							<FontAwesome5 name="sign-out-alt" size={13} color={theme.textSecondary} />
						</View>
						<Text style={styles.rowLabel}>Log Out</Text>
					</TouchableOpacity>
				</View>

				{/* Danger */}
				<Text style={styles.sectionLabel}>Danger Zone</Text>
				<TouchableOpacity style={styles.dangerRow} activeOpacity={0.7}>
					<FontAwesome5 name="trash-alt" size={15} color={theme.error} />
					<Text style={styles.dangerText}>Delete Account</Text>
					<FontAwesome5 name="chevron-right" size={12} color={theme.error} />
				</TouchableOpacity>

			</ScrollView>
		</SafeAreaView>
	);
}
