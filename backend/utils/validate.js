const { DataError } = require("../error");

//trim + max length. Empty (or not a string) -> null so callers decide if that's allowed
function cleanText(value, max, label) {
	const trimmed = typeof value === "string" ? value.trim() : "";
	if (trimmed.length > max) throw new DataError(`${label} can be at most ${max} characters`);
	return trimmed || null;
}

module.exports = { cleanText };
