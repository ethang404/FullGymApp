import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useMemo } from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { formatRelativeDate } from "@/utils/date";
import { displayName, type Friend } from "../../types/friends";

interface Props {
	friend: Friend;
	onPress: () => void;
	onRemove: () => void;
	busy?: boolean;
}

export default function FriendListRow({ friend, onPress, onRemove, busy }: Props) {
	const { theme } = useTheme();
	const name = displayName(friend);

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
				meta: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
				removeBtn: { padding: 8, opacity: busy ? 0.5 : 1 },
			}),
		[theme, busy],
	);

	return (
		<TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
			<View style={styles.avatar}>
				<Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
			</View>
			<View style={{ flex: 1 }}>
				<Text style={styles.name} numberOfLines={1}>
					{name}
				</Text>
				<Text style={styles.meta} numberOfLines={1}>
					@{friend.user_name} · Friends since {formatRelativeDate(friend.since)}
				</Text>
			</View>
			<TouchableOpacity style={styles.removeBtn} onPress={onRemove} disabled={busy} hitSlop={8}>
				<FontAwesome5 name="user-minus" size={14} color={theme.textTertiary} />
			</TouchableOpacity>
			<FontAwesome5 name="chevron-right" size={12} color={theme.textTertiary} />
		</TouchableOpacity>
	);
}
