async function BlockGuest(req, res, next) {
	const isGuest = req.is_guest;
	if (isGuest) return res.status(403).json({ message: "Guests can't view this page. Sign up for a full account to continue" });
	next();
}

module.exports = BlockGuest;
