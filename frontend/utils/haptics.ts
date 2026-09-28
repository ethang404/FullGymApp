import * as Haptics from "expo-haptics";

// Small, fire-and-forget haptic cues. Haptics can be unavailable (simulator, web,
// some Android devices), so failures are ignored rather than surfaced.
export const haptics = {
	/** A light tick for small additions, like adding a set. */
	tap: () => Haptics.selectionAsync().catch(() => {}),
	/** A confirmation for finished actions, like saving a workout or logging food. */
	success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
};
