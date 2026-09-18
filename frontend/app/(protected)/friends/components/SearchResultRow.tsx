import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useMemo } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { displayName, type UserSearchResult } from "../../types/friends";

interface Props {
	result: UserSearchResult;
	onAdd: () => void;
	busy?: boolean;
}

// Search results only carry a `relationship` label, not a friendship_id (see
// GET /friends/search) — so only the "none" state is actionable here. Anything already
// in flight (pending either direction) or already a friend is managed from the
// Pending Approvals / My Friends sections below, which do have the id to act on.
export default function SearchResultRow({ result, onAdd, busy }: Props) {
	const { theme } = useTheme();
	const name = displayName(result);

	const styles = useMemo(
		() =>
			StyleSheet.create({
				row: {
					flexDirection: "row",
					alignItems: "center",
					backgroundColor: theme.cardBg,
					borderRadius: 14,
					padding: 14,
					borderWidth: 1,
					borderColor: theme.border,
					gap: 12,
				},
				avatar: {
					width: 40,
					height: 40,
					borderRadius: 20,
					backgroundColor: theme.cardBgAlt,
					alignItems: "center",
					justifyContent: "center",
					borderWidth: 1,
					borderColor: theme.border,
				},
				avatarText: { fontSize: 15, fontWeight: "700", color: theme.primary },
				name: { fontSize: 14, fontWeight: "700", color: theme.text },
				handle: { fontSize: 12, color: theme.textMuted, marginTop: 1 },
				addBtn: {
					flexDirection: "row",
					alignItems: "center",
					gap: 6,
					backgroundColor: theme.primary,
					borderRadius: 10,
					paddingVertical: 8,
					paddingHorizontal: 14,
					opacity: busy ? 0.6 : 1,
				},
				addText: { color: theme.textInverse, fontWeight: "700", fontSize: 12 },
				statusPill: {
					borderRadius: 10,
					paddingVertical: 8,
					paddingHorizontal: 12,
					backgroundColor: theme.cardBgAlt,
					borderWidth: 1,
					borderColor: theme.border,
				},
				statusText: { color: theme.textMuted, fontWeight: "600", fontSize: 12 },
			}),
		[theme, busy],
	);

	const statusLabel =
		result.relationship === "pending_outgoing"
			? "Requested"
			: result.relationship === "pending_incoming"
				? "Respond below"
				: result.relationship === "friends"
					? "Friends"
					: null;

	return (
		<View style={styles.row}>
			<View style={styles.avatar}>
				<Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
			</View>
			<View style={{ flex: 1 }}>
				<Text style={styles.name} numberOfLines={1}>
					{name}
				</Text>
				<Text style={styles.handle} numberOfLines={1}>
					@{result.user_name}
				</Text>
			</View>
			{statusLabel ? (
				<View style={styles.statusPill}>
					<Text style={styles.statusText}>{statusLabel}</Text>
				</View>
			) : (
				<TouchableOpacity style={styles.addBtn} onPress={onAdd} disabled={busy} activeOpacity={0.8}>
					<FontAwesome5 name="user-plus" size={11} color={theme.textInverse} />
					<Text style={styles.addText}>Add</Text>
				</TouchableOpacity>
			)}
		</View>
	);
}
