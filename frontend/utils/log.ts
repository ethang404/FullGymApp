// Dev-only logging. In production builds (`__DEV__ === false`) every call is a
// no-op, so we never ship console noise — and never risk logging tokens or PII.
// User-facing failures should surface through the toast system, not here.

/* eslint-disable no-console */
export const log = {
	debug: (...args: unknown[]) => {
		if (__DEV__) console.log(...args);
	},
	warn: (...args: unknown[]) => {
		if (__DEV__) console.warn(...args);
	},
	error: (...args: unknown[]) => {
		if (__DEV__) console.error(...args);
	},
};
