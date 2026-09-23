function blockGuest(req, res, next) {
	if (req.is_guest) {
		return res.status(403).json({ message: "Guests can't use Friends. Create an account to add friends." });
	}
	next();
}

module.exports = blockGuest;
