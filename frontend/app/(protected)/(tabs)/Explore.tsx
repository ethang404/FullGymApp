import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator, RefreshControl } from "react-native";
import { useMemo, useState } from "react";
import { router, type Href } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "@/theme/ThemeProvider";
import { ScreenState } from "@/components/ScreenState";
import Screen from "@/components/Screen";
import SegmentedControl from "@/components/SegmentedControl";
import FilterChips from "./explore/components/FilterChips";
import ExploreCard from "./explore/components/ExploreCard";
import { useExploreFeed } from "./explore/hooks/useExploreFeed";
import { EXPLORE_TYPES, EXPLORE_SCOPES, type ExploreItem } from "../types/explore";

const TYPE_LABELS = { all: "All", recipe: "Recipes", workout: "Workouts" };
const SCOPE_LABELS = { all: "Everyone", friends: "Friends", public: "Public", mine: "Mine" };

export default function Explore() {
	const { theme } = useTheme();
	const [search, setSearch] = useState("");
	const [type, setType] = useState<(typeof EXPLORE_TYPES)[number]>("all");
	const [scope, setScope] = useState<(typeof EXPLORE_SCOPES)[number]>("all");
	const [refreshing, setRefreshing] = useState(false);

	const { items, loading, loadingMore, error, hasMore, loadMore, refresh } = useExploreFeed({ type, scope, search });

	function goToItem(item: ExploreItem) {
		if (item.type === "recipe") {
			router.push(`/nutrition/CreateRecipe?recipe_id=${item.id}`);
		} else {
			router.push({ pathname: "/(protected)/workouts/[workout_id]", params: { workout_id: String(item.id), mode: "view" } } as Href);
		}
	}

	const styles = useMemo(
		() =>
			StyleSheet.create({
				scroll: { flex: 1 },
				content: { padding: 16, paddingBottom: 32, gap: 10 },
				pageTitle: { fontSize: 22, fontWeight: "800", color: theme.text, marginBottom: 12 },
				searchBar: {
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
					backgroundColor: theme.inputBg,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: theme.inputBorder,
					borderRadius: 12,
					paddingHorizontal: 14,
					paddingVertical: 10,
					marginBottom: 12,
				},
				searchInput: { flex: 1, color: theme.text, fontSize: 15 },
				typeRow: { marginBottom: 10 },
				scopeRow: { marginBottom: 16 },
				emptyState: { alignItems: "center", paddingVertical: 40, gap: 8 },
				emptyTitle: { fontSize: 16, fontWeight: "700", color: theme.textMuted },
				emptySubtitle: { fontSize: 13, color: theme.textTertiary, textAlign: "center" },
				footerLoading: { paddingVertical: 20, alignItems: "center" },
			}),
		[theme],
	);

	const header = (
		<>
			<Text style={styles.pageTitle}>Explore</Text>
			<View style={styles.searchBar}>
				<FontAwesome5 name="search" size={14} color={theme.inputPlaceholder} />
				<TextInput
					style={styles.searchInput}
					placeholder="Search recipes, workouts..."
					placeholderTextColor={theme.inputPlaceholder}
					value={search}
					onChangeText={setSearch}
					autoCapitalize="none"
					autoCorrect={false}
				/>
			</View>
			<View style={styles.typeRow}>
				<SegmentedControl options={EXPLORE_TYPES} value={type} onChange={setType} labels={TYPE_LABELS} />
			</View>
			<View style={styles.scopeRow}>
				<FilterChips options={EXPLORE_SCOPES} value={scope} onSelect={setScope} labels={SCOPE_LABELS} />
			</View>
		</>
	);

	return (
		<Screen edges={["top"]}>
			<ScreenState loading={loading} error={error} onRetry={refresh} errorTitle="Couldn't load Explore">
				<FlatList
					data={items}
					keyExtractor={(item) => `${item.type}:${item.id}`}
					renderItem={({ item }) => <ExploreCard item={item} onPress={() => goToItem(item)} />}
					ListHeaderComponent={header}
					ListEmptyComponent={
						<View style={styles.emptyState}>
							<FontAwesome5 name="compass" size={32} color={theme.textTertiary} />
							<Text style={styles.emptyTitle}>Nothing here yet</Text>
							<Text style={styles.emptySubtitle}>Try a different filter, or check back once friends start sharing.</Text>
						</View>
					}
					ListFooterComponent={
						hasMore && loadingMore ? (
							<View style={styles.footerLoading}>
								<ActivityIndicator color={theme.primary} />
							</View>
						) : null
					}
					onEndReachedThreshold={0.4}
					onEndReached={loadMore}
					style={styles.scroll}
					contentContainerStyle={styles.content}
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={async () => {
								setRefreshing(true);
								await refresh();
								setRefreshing(false);
							}}
							tintColor={theme.primary}
						/>
					}
				/>
			</ScreenState>
		</Screen>
	);
}
