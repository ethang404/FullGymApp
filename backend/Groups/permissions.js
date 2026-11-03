//Who can do what in a group. Groups/service.js and Posts/service.js both use these.
//Only requires models + errors, so Posts can import it without pulling in the whole Groups service
const { NotFoundError, ForbiddenError } = require("../error");
const { groups: groupsModel, group_members: membersModel } = require("../models/modelInits");

//higher number = more power. Owner can act on admins + members, admins on members
const rank_ordering = {
	member: 1,
	admin: 2,
	owner: 3,
};

async function findGroupOr404(group_id) {
	const group = await groupsModel.findByPk(group_id);
	if (!group) throw new NotFoundError("Group not found");
	return group;
}

//my row in this group, or null if I have none
async function findMembership(group_id, user_id) {
	return membersModel.findOne({ where: { group_id, user_id } });
}

//owner or admin with an active row
function isManager(membership) {
	return membership?.status === "active" && ["owner", "admin"].includes(membership.role);
}

function isOwner(membership) {
	return membership?.status === "active" && membership.role === "owner";
}

//you can only act on someone ranked strictly below you (so nobody can act on the owner)
function outranks(actor_role, target_role) {
	return rank_ordering[actor_role] > rank_ordering[target_role];
}

//true if we're active member in a group
async function isActiveMember(group_id, user_id) {
	const membership = await membersModel.findOne({ where: { group_id, user_id, status: "active" } });
	return membership !== null;
}

//true if we're an active owner/admin of the group
async function isGroupManager(group_id, user_id) {
	return isManager(await findMembership(group_id, user_id));
}

//my membership if I'm an active owner/admin, otherwise 403
async function requireManager(group_id, user_id, message) {
	const membership = await findMembership(group_id, user_id);
	if (!isManager(membership)) throw new ForbiddenError(message);
	return membership;
}

//my membership if I'm the active owner, otherwise 403
async function requireOwner(group_id, user_id, message) {
	const membership = await findMembership(group_id, user_id);
	if (!isOwner(membership)) throw new ForbiddenError(message);
	return membership;
}

//group + my row (or null). Missing group or I'm banned -> 404, so a ban looks like the group is gone
async function findVisibleGroup(group_id, user_id) {
	const group = await findGroupOr404(group_id);
	const membership = await findMembership(group_id, user_id);
	if (membership?.status === "banned") throw new NotFoundError("Group not found");
	return { group, membership };
}

module.exports = {
	findGroupOr404,
	findMembership,
	isManager,
	isOwner,
	outranks,
	isActiveMember,
	isGroupManager,
	requireManager,
	requireOwner,
	findVisibleGroup,
};
