// Workout weights are entered and shown in kg across the app (see the set inputs in workouts/[workout_id].tsx).
export const WEIGHT_UNIT = "kg";

// "full_body" → "Full body"
export function muscleLabel(muscleGroup: string): string {
	const s = muscleGroup.replace(/_/g, " ");
	return s.charAt(0).toUpperCase() + s.slice(1);
}

// 80 → "80", 101.3333 → "101.3", keeps plate-math weights like 22.5 intact
export function formatWeight(value: number): string {
	return String(Math.round(value * 10) / 10);
}

export interface NiceScale {
	min: number;
	max: number;
	step: number;
	sections: number;
}

function niceStep(rawStep: number): number {
	if (rawStep <= 0) return 1;
	const magnitude = 10 ** Math.floor(Math.log10(rawStep));
	const normalized = rawStep / magnitude;
	const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
	return nice * magnitude;
}

// Round axis bounds out to readable tick values (e.g. 93–101 → 90–105 in steps of 5) so a lift's chart zooms
// in on its actual range instead of starting at 0, where real progress looks like a flat line.
export function niceScale(dataMin: number, dataMax: number, targetSections = 4, { minStep = 0, floorAtZero = true } = {}): NiceScale {
	let lo = dataMin;
	let hi = dataMax;
	if (lo === hi) {
		const pad = hi === 0 ? 1 : Math.abs(hi) * 0.1;
		lo -= pad;
		hi += pad;
	}
	const step = Math.max(niceStep((hi - lo) / targetSections), minStep);
	let min = Math.floor(lo / step) * step;
	if (floorAtZero) min = Math.max(0, min);
	const max = Math.ceil(hi / step) * step;
	return { min, max, step, sections: Math.max(1, Math.round((max - min) / step)) };
}

// A 0-based axis with exactly `sections` nice steps - used when two y-axes share gridlines and must have the
// same number of sections.
export function niceZeroBasedMax(dataMax: number, sections: number): number {
	return niceStep(Math.max(dataMax, 1) / sections) * sections;
}

// Show every nth x-axis label so dates don't overlap when a lift has lots of sessions.
export function labelEvery(pointCount: number, chartWidth: number, minLabelGap = 52): number {
	const maxLabels = Math.max(1, Math.floor(chartWidth / minLabelGap));
	return Math.max(1, Math.ceil(pointCount / maxLabels));
}
