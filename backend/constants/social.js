//the only user fields other people ever see (search, friends, members, post authors).
//never serializeUser for someone else - that has body metrics + goals
const PUBLIC_USER_ATTRIBUTES = ["user_id", "user_name", "first_name", "last_name"];

module.exports = { PUBLIC_USER_ATTRIBUTES };
