// Shared date helpers. Every formatter parses a plain `YYYY-MM-DD` string in
// LOCAL time (not UTC) so a calendar date never shifts a day near midnight —
// the bug that made "today" render as "Yesterday" in western timezones.
// Strings that carry a time component are left to the platform Date parser,
// which honours the offset in the string.

function parseLocalDate(dateStr: string): Date | null {
	if (!dateStr) return null;
	const pureDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
	const d = pureDate
		? new Date(Number(pureDate[1]), Number(pureDate[2]) - 1, Number(pureDate[3]))
		: new Date(dateStr);
	return isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date): Date {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	return x;
}

function calendarDayDiff(from: Date, to: Date): number {
	return Math.round((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / 86400000);
}

/** Today as a local `YYYY-MM-DD` string. */
export function todayISO(): string {
	return toISO(new Date());
}

/** A local `YYYY-MM-DD` string shifted by whole days (negative goes back). */
export function shiftISODate(iso: string, days: number): string {
	const d = parseLocalDate(iso) ?? new Date();
	d.setDate(d.getDate() + days);
	return toISO(d);
}

/** `Sep 1, 2026` — invalid input falls back to `"Unknown date"`. */
export function formatMediumDate(dateStr: string): string {
	const d = parseLocalDate(dateStr);
	if (!d) return "Unknown date";
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** `Sep 1` — invalid input falls back to `fallback` (default `""`). */
export function formatShortDate(dateStr: string, fallback = ""): string {
	const d = parseLocalDate(dateStr);
	if (!d) return fallback;
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** `Today` / `Yesterday` / `N days ago` (< 7) / else `formatMediumDate`. */
export function formatRelativeDate(dateStr: string): string {
	const d = parseLocalDate(dateStr);
	if (!d) return "Unknown date";
	const diffDays = calendarDayDiff(d, new Date());
	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
	return formatMediumDate(dateStr);
}

/** Uppercase day banner: `TODAY` / `YESTERDAY` / `TOMORROW` / `MONDAY, SEP 1`. */
export function formatDayHeading(dateStr: string): string {
	const d = parseLocalDate(dateStr);
	if (!d) return "";
	const diffDays = calendarDayDiff(new Date(), d);
	if (diffDays === 0) return "TODAY";
	if (diffDays === -1) return "YESTERDAY";
	if (diffDays === 1) return "TOMORROW";
	return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase();
}
