const bcrypt = require("bcrypt");
const crypto = require("crypto");

const SALT_ROUNDS = 10;

//PEPPER (server secret) is added to every password before hashing or comparing
async function hashPassword(password) {
	const salt = await bcrypt.genSalt(SALT_ROUNDS);
	return bcrypt.hash(password + process.env.PEPPER, salt);
}

function checkPassword(password, hash) {
	return bcrypt.compare(password + process.env.PEPPER, hash);
}

//guests and OAuth users never log in with a password, but the column is NOT NULL - so store a hash of random bytes
function guestHashPassword() {
	return hashPassword(crypto.randomBytes(24).toString("hex"));
}

module.exports = { hashPassword, checkPassword, guestHashPassword };
