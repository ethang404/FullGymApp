import { Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useReorderableDrag } from "react-native-reorderable-list";
import { useTheme } from "@/theme/ThemeProvider";

//Touch-and-drag handle. Drags whichever reorderable list cell it sits in (a set row, or a whole exercise card).
//Only render it inside a ReorderableList cell: the hook throws anywhere else.
export function DragGrip({ label }: { label: string }) {
	const { theme } = useTheme();
	const drag = useReorderableDrag();

	return (
		<Pressable onPressIn={drag} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}>
			<MaterialIcons name="drag-indicator" size={20} color={theme.textTertiary} />
		</Pressable>
	);
}
