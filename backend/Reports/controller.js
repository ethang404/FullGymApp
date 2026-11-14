const service = require("./service");

// Body needs: { target_type, target_id, reason, note? }
async function createReport(req, res) {
	await service.createReport(req.user_id, req.is_guest, req.body ?? {});
	return res.status(201).json({ message: "Report received" });
}

// ---------------------------------------------
// Admin (routes are in Admin/route.js)
// ---------------------------------------------

// /admin/reports?status=open&reported_user_id=5&cursor=...&limit=20
async function getReports(req, res) {
	const { status, reported_user_id, cursor, limit } = req.query;
	const result = await service.getReports({ status, reported_user_id, cursor, limit }); //{ reports, next_cursor }
	return res.status(200).json(result);
}

// Body needs: { status }
async function resolveReport(req, res) {
	const report_id = parseInt(req.params.id, 10);
	const report = await service.resolveReport(report_id, req.body?.status);
	return res.status(200).json({ report });
}

async function removeTarget(req, res) {
	const report_id = parseInt(req.params.id, 10);
	const report = await service.removeTarget(report_id);
	return res.status(200).json({ report });
}

module.exports = { createReport, getReports, resolveReport, removeTarget };
