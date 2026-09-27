// Perceived-brightness check (YIQ) used to pick a light/dark variant of a
// platform-branded button (Apple/Google) so it stays legible against a themed card.
export function isDarkColor(hex: string): boolean {
	const normalized = hex.replace("#", "");
	const r = parseInt(normalized.substring(0, 2), 16);
	const g = parseInt(normalized.substring(2, 4), 16);
	const b = parseInt(normalized.substring(4, 6), 16);
	const yiq = (r * 299 + g * 587 + b * 114) / 1000;
	return yiq < 128;
}
