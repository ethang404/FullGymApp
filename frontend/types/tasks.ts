export type TaskFrequency = "hourly" | "daily" | "weekly";

export interface Task {
	id: string;
	title: string;
	frequency: TaskFrequency;
	done: boolean;
	// ISO timestamp of when the task was last marked done; null while pending.
	// Used to figure out when a recurring task's `done` flag should reset.
	completedAt: string | null;
}
