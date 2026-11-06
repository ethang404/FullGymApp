//Goes after verifyToken. Admins are the user ids listed in ADMIN_USER_IDS (comma separated).
function requireAdmin(req, res, next) {
	const admin_ids = (process.env.ADMIN_USER_IDS ?? "").split(",").map((id) => parseInt(id, 10));
	if (!admin_ids.includes(req.user_id)) return res.status(403).json({ message: "Admins only" });
	next();
}

module.exports = requireAdmin;
