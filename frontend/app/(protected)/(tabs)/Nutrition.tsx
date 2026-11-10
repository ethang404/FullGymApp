import { RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { useTheme } from "@/theme/ThemeProvider";
import { todayISO } from "@/utils/date";
import { useProfile } from "@/utils/ProfileProvider";
import { ScreenState } from "@/components/ScreenState";
import Screen from "@/components/Screen";

import LogFoodModal from "@/features/nutrition/components/LogFoodModal";
import DiarySections from "@/features/nutrition/components/DiarySections";
import DateNavBar from "@/features/nutrition/components/DateNavBar";
import { useDiary } from "@/features/nutrition/hooks/useDiary";
import type { MealType } from "@/features/nutrition/types";

export default function Nutrition() {
	const { theme } = useTheme();
	const { goals } = useProfile();
	const insets = useSafeAreaInsets();

	//default date to today
	const [selectedDate, setSelectedDate] = useState<string>(todayISO);
	const diary = useDiary(selectedDate);

	// UI-only: which meal the log sheet is open for
	const [logModalVisible, setLogModalVisible] = useState(false);
	const [activeMealType, setActiveMealType] = useState<MealType>("breakfast");

	return (
		<Screen edges={["top"]}>
			{/* Outside ScreenState so you can still switch days while a day is loading or failed */}
			<DateNavBar selectedDate={selectedDate} onChange={setSelectedDate} />

			<ScreenState loading={diary.loading} error={diary.error} onRetry={diary.refetch} errorTitle="Couldn't load your diary">
				<DiarySections
					entries={diary.entries}
					goals={goals}
					onAddMeal={(mealType) => {
						setActiveMealType(mealType);
						setLogModalVisible(true);
					}}
					bottomInset={insets.bottom}
					refreshControl={<RefreshControl refreshing={diary.refreshing} onRefresh={diary.refresh} tintColor={theme.primary} />}
				/>
			</ScreenState>

			{/* Log food modal */}
			<LogFoodModal
				visible={logModalVisible}
				mealType={activeMealType}
				selectedDate={selectedDate}
				onClose={() => setLogModalVisible(false)}
				onLogged={diary.refetch}
			/>
		</Screen>
	);
}
