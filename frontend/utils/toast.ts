// Fire-and-forget toast, callable from anywhere — including non-React code such
// as the axios interceptor. ToastProvider registers the real handler on mount;
// until then (or in tests) every call is a safe no-op.

export type ToastType = "success" | "error" | "info";

type ShowFn = (message: string, type: ToastType) => void;

let handler: ShowFn | null = null;

/** Internal — ToastProvider registers/unregisters the active handler. */
export function _setToastHandler(fn: ShowFn | null) {
	handler = fn;
}

export const toast = {
	show(message: string, type: ToastType = "error") {
		handler?.(message, type);
	},
	success(message: string) {
		handler?.(message, "success");
	},
	error(message: string) {
		handler?.(message, "error");
	},
	info(message: string) {
		handler?.(message, "info");
	},
};
