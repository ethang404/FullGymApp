const service = require("./service");

// Body needs: { target_type, target_id, reason, note? }
async function createReport(req, res) {
	await service.createReport(req.user_id, req.is_guest, req.body ?? {});
	return res.status(201).json({ message: "Report received" });
}

module.exports = { createReport };
