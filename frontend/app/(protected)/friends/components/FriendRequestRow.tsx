import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useMemo } from "react";
import { useTheme } from "@/theme/ThemeProvider";
import { formatRelativeDate } from "@/utils/date";
import { displayName, type FriendRequest, type RequestDirection } from "../../types/friends";

interface Props {
	request: FriendRequest;
	direction: RequestDirection;
	onAccept?: () => void;
	/** Declines (incoming) or cancels (outgoing) — same backend action either way. */
	onDecline: () => void;
	busy?: boolean;
}

export default function FriendRequestRow({ request, direction, onAccept, onDecline, busy }: Props) {
	const { theme } = useTheme();
	const name = displayName(request);

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
					width: 44,
					height: 44,
					borderRadius: 22,
					backgroundColor: theme.cardBgAlt,
					alignItems: "center",
					justifyContent: "center",
					borderWidth: 1,
					borderColor: theme.border,
				},
				avatarText: { fontSize: 16, fontWeight: "700", color: theme.primary },
				name: { fontSize: 15, fontWeight: "700", color: theme.text },
				handle: { fontSize: 12, color: theme.textMuted, marginTop: 1 },
				meta: { fontSize: 11, color: theme.textTertiary, marginTop: 2 },
				actions: { flexDirection: "row", gap: 8 },
				acceptBtn: {
					backgroundColor: theme.primary,
					borderRadius: 10,
					paddingVertical: 8,
					paddingHorizontal: 14,
					opacity: busy ? 0.6 : 1,
				},
				acceptText: { color: theme.textInverse, fontWeight: "700", fontSize: 12 },
				declineBtn: {
					backgroundColor: theme.cardBgAlt,
					borderRadius: 10,
					paddingVertical: 8,
					paddingHorizontal: 14,
					borderWidth: 1,
					borderColor: theme.border,
					opacity: busy ? 0.6 : 1,
				},
				declineText: { color: theme.textSecondary, fontWeight: "700", fontSize: 12 },
			}),
		[theme, busy],
	);

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
					@{request.user_name}
				</Text>
				<Text style={styles.meta}>{formatRelativeDate(request.requested_at)}</Text>
			</View>
			<View style={styles.actions}>
				{direction === "incoming" && onAccept && (
					<TouchableOpacity style={styles.acceptBtn} onPress={onAccept} disabled={busy} activeOpacity={0.8}>
						<Text style={styles.acceptText}>Accept</Text>
					</TouchableOpacity>
				)}
				<TouchableOpacity style={styles.declineBtn} onPress={onDecline} disabled={busy} activeOpacity={0.8}>
					<Text style={styles.declineText}>{direction === "incoming" ? "Decline" : "Cancel"}</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}
