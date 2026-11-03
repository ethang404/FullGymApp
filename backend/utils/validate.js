const { DataError } = require("../error");

//trim + max length. Empty (or not a string) -> null so callers decide if that's allowed
function cleanText(value, max, label) {
	const trimmed = typeof value === "string" ? value.trim() : "";
	if (trimmed.length > max) throw new DataError(`${label} can be at most ${max} characters`);
	return trimmed || null;
}

//value has to be one of the allowed options, e.g. assertOneOf(meal_type, MEAL_TYPES, "meal_type")
function assertOneOf(value, allowed, label) {
	if (!allowed.includes(value)) throw new DataError(`${label} must be one of: ${allowed.join(", ")}`);
}

module.exports = { cleanText, assertOneOf };
