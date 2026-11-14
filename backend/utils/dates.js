const { DataError } = require("../error");

//"YYYY-MM-DD" and a real calendar date
function isValidDate(str) {
	return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str));
}

//a full ISO date and time like toISOString() gives ("2026-11-07T18:30:00.000Z"). A bare date is rejected:
//it would mean midnight UTC, which is the exact bug started_at fixes
function isValidTimestamp(str) {
	return typeof str === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str) && !isNaN(Date.parse(str));
}

//start required, end defaults to start, both YYYY-MM-DD, end can't be before start.
//checked up front so a bad date is a 400 instead of reaching postgres as a 500
function parseDateRange(start_date, end_date) {
	if (!start_date) throw new DataError("start_date is required");
	if (!isValidDate(start_date)) throw new DataError("start_date must be YYYY-MM-DD");

	if (!end_date) end_date = start_date;
	if (!isValidDate(end_date)) throw new DataError("end_date must be YYYY-MM-DD");
	if (end_date < start_date) throw new DataError("end_date cannot be before start_date");

	return { start_date, end_date };
}

module.exports = { isValidDate, isValidTimestamp, parseDateRange };
