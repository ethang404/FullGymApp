const { NotFoundError, DataError, ForbiddenError, ConflictError } = require("../error");
const { Op } = require("sequelize");
const { users: userModel, groups: groupsModel, group_members: membersModel } = require("../models/modelInits");
const sequelize = require("../models/db");
const { cleanText, assertOneOf } = require("../utils/validate");
const { PUBLIC_USER_ATTRIBUTES } = require("../constants");
const { isBlocked, excludeHiddenUsers } = require("../utils/social");

//who-can-do-what helpers live in permissions.js so Posts can use them too
const { findGroupOr404, findMembership, isManager, outranks, requireManager, requireOwner, findVisibleGroup } = require("./permissions");

const JOIN_POLICIES = ["open", "request", "invite_only"];
const MAX_NAME_LENGTH = 255; //groups.name is STRING(255)

// Functions Groups/controller.js calls (the acting user is req.user_id):
//
// getMyGroups(user_id)                                          -> { active, invited }
// searchGroups(user_id, search)                                 -> [group]
// createGroup(user_id, data)                                    -> group (creator's "owner" membership in the same transaction)
// getGroup(group_id, user_id)                                   -> group
// updateGroup(group_id, user_id, patch)                         -> group
// deleteGroup(group_id, user_id)
// joinGroup(group_id, user_id)                                  -> membership
// inviteMember(group_id, user_id, invitee_id)                   -> membership
// acceptInvite(group_id, user_id)                               -> membership
// approveRequest(group_id, user_id, member_id)                  -> membership
// getMembers(group_id, user_id)                                 -> [member]
// updateMemberRole(group_id, user_id, member_id, role)          -> membership
// removeMember(group_id, user_id, member_id) -self or kick
// transferOwnership(group_id, user_id, new_owner_id)            -> group
//
// The group feed (GET /groups/:id/posts) calls Posts/service.js -> getGroupFeed, not this file.

async function getMyGroups(user_id) {
	//get any groups we're in + invited to
	//we need to go through junction table I think
	const user = await userModel.findByPk(user_id);
	if (!user) throw new NotFoundError();

	const groups = await user.getGroups({
		through: { where: { status: ["active", "invited"] } }, //filter on the junction row
		joinTableAttributes: ["role", "status"], //only bring these back from group_members
		order: [["name", "ASC"]],
	});

	//extract group members field and place us directly in group return
	const toGroup = (g) => {
		const { group_members, ...group } = g.toJSON();
		return { ...group, role: group_members.role, status: group_members.status };
	};

	//group into active vs invited
	return {
		active: groups.filter((g) => g.group_members.status === "active").map(toGroup),
		invited: groups.filter((g) => g.group_members.status === "invited").map(toGroup),
	};
}

async function searchGroups(user_id, search) {
	if (!search) return [];

	const groups = await groupsModel.findAll({
		where: {
			name: { [Op.iLike]: `%${search}%` },
			[Op.or]: [{ "$memberships.status$": null }, { "$memberships.status$": { [Op.ne]: "banned" } }],
		},
		include: [
			{
				model: membersModel,
				as: "memberships", //required since we used alias

				where: { user_id }, //any group we're not in (via group members) is NULL or defined
				required: false, //these 2 parts give us ALL groups joined with group members (required:false)

				//tldr; required means we'd get null for groups w/ 0 members and would give us every person
				//the user_id gives us either a group we're in, or a null
				attributes: ["role", "status"],
			},
		],
	});

	//memberships is [] or [my row] - flatten to my_role/my_status, same as getGroup
	return groups.map((g) => {
		const { memberships, ...group } = g.toJSON();
		return { ...group, my_role: memberships[0]?.role ?? null, my_status: memberships[0]?.status ?? null };
	});
}

async function createGroup(user_id, data) {
	const { description, join_policy } = data;
	const name = cleanText(data.name, MAX_NAME_LENGTH, "group name");
	if (!name) throw new DataError("group name is required");

	//model defaults to "open". Checked here so a bad value is a 400, not a DB 500
	if (join_policy !== undefined) assertOneOf(join_policy, JOIN_POLICIES, "join_policy");

	return sequelize.transaction(async (t) => {
		const newGroup = await groupsModel.create({ name, description, join_policy, created_by: user_id }, { transaction: t });

		await membersModel.create({ group_id: newGroup.id, user_id, role: "owner", status: "active" }, { transaction: t });

		return newGroup;
	});
}

//anyone can view a group (search shows them all) except people banned from it
async function getGroup(group_id, user_id) {
	const { group, membership } = await findVisibleGroup(group_id, user_id); //404 so a ban looks like the group is gone

	const member_count = await membersModel.count({ where: { group_id, status: "active" } });

	return {
		...group.toJSON(),
		member_count,
		my_role: membership?.role ?? null,
		my_status: membership?.status ?? null, //null for group we're not in
	};
}

//owner/admin only. Only name, description, join_policy can change
async function updateGroup(group_id, user_id, patch) {
	const group = await findGroupOr404(group_id);
	await requireManager(group_id, user_id, "Only the owner or an admin can edit this group");

	const { description, join_policy } = patch;
	//undefined = not sent, so leave it alone. Checked here so a bad value is a 400, not a DB 500
	let name;
	if (patch.name !== undefined) {
		name = cleanText(patch.name, MAX_NAME_LENGTH, "group name");
		if (!name) throw new DataError("group name can't be empty");
	}
	if (join_policy !== undefined) assertOneOf(join_policy, JOIN_POLICIES, "join_policy");

	//update skips keys that are undefined, so only the fields that were sent change
	await group.update({ name, description, join_policy });
	return group;
}

//owner only. group_members + posts rows go with it (ON DELETE CASCADE in modelInits)
async function deleteGroup(group_id, user_id) {
	const group = await findGroupOr404(group_id);
	await requireOwner(group_id, user_id, "Only the owner can delete this group");

	await group.destroy();
}

//if open -> active. if request -> pending. if invite_only -> 403. Already invited -> counts as accepting
async function joinGroup(group_id, user_id) {
	const group = await findGroupOr404(group_id);

	const existing = await findMembership(group_id, user_id);
	if (existing) {
		if (existing.status === "banned") throw new NotFoundError("Group not found"); //same as getGroup - a ban hides the group
		if (existing.status === "active") throw new ConflictError("You're already in this group");
		if (existing.status === "pending") throw new ConflictError("You've already requested to join this group");

		//if invited -> joinGroup accepts invite
		return existing.update({ status: "active" });
	}

	if (group.join_policy === "invite_only") throw new ForbiddenError("This group is invite only");

	//if group open policy: join. Otherwise, set our application to pending
	const status = group.join_policy === "open" ? "active" : "pending";

	return membersModel.create({ group_id, user_id, role: "member", status });
}

//owner/admin only, any join policy. Invitee already requested -> just approve them
async function inviteMember(group_id, user_id, invitee_id) {
	if (!Number.isInteger(invitee_id)) throw new DataError("user_id for invitee is required");
	if (invitee_id === user_id) throw new DataError("You can't invite yourself");

	await findGroupOr404(group_id); //make sure valid group

	//make sure we're in this group and we're a manager sort
	await requireManager(group_id, user_id, "Only the owner or an admin can invite people");

	//Make sure person we're inviting is not a guest(no social features allowed), banned, or blocked by us
	const invitee = await userModel.findByPk(invitee_id, { attributes: ["user_id", "is_guest", "is_banned"] });
	if (!invitee || invitee.is_guest || invitee.is_banned) throw new NotFoundError("User not found");
	if (await isBlocked(user_id, invitee_id)) throw new ForbiddenError("Can't invite this user");

	const existing = await findMembership(group_id, invitee_id);
	if (existing) {
		//Make sure user isn't already in group, not already invited, and not banned from the group
		if (existing.status === "active") throw new ConflictError("This user is already in the group");
		if (existing.status === "invited") throw new ConflictError("This user is already invited");
		if (existing.status === "banned") throw new ConflictError("This user is banned - unban them first");

		return existing.update({ status: "active" }); //if invitee already requested to join (pending) let them in via invite
	}

	return membersModel.create({ group_id, user_id: invitee_id, role: "member", status: "invited", invited_by: user_id });
}

//invitee accepts invite, just update status
async function acceptInvite(group_id, user_id) {
	const membership = await findMembership(group_id, user_id);
	if (membership?.status !== "invited") throw new NotFoundError("Invite not found");

	return membership.update({ status: "active" });
}

//owner/admin flips someone's ("pending") request to join group ("active")
async function approveRequest(group_id, user_id, member_id) {
	await findGroupOr404(group_id);
	await requireManager(group_id, user_id, "Only the owner or an admin can approve requests");

	const request = await findMembership(group_id, member_id);
	if (request?.status !== "pending") throw new NotFoundError("Join request not found");

	return request.update({ status: "active" });
}

//anyone not banned sees active members. Owner/admin also see pending/invited/banned so they can manage them
//shows all if manager, else hides banned/blocked users
async function getMembers(group_id, user_id) {
	//we can only see members in group if we're not banned from it
	const { membership } = await findVisibleGroup(group_id, user_id);

	const base = isManager(membership) ? { group_id } : { group_id, status: "active" };
	const where = isManager(membership) ? base : await excludeHiddenUsers(base, user_id);

	const rows = await membersModel.findAll({
		where,
		include: [{ model: userModel, as: "user", attributes: PUBLIC_USER_ATTRIBUTES }],
		order: [
			["role", "ASC"],
			["created_at", "ASC"],
		],
	});

	return rows.map((row) => {
		const { user, role, status, invited_by, createdAt } = row.get({ plain: true });
		return { ...user, role, status, invited_by, joined_at: createdAt };
	});
}

//owner only, member <-> admin. Owner role only moves through transferOwnership
async function updateMemberRole(group_id, user_id, member_id, role) {
	//Only owners can change role of others
	//others (members) can become admins, or admins can become members

	if (role === "owner") throw new DataError("Use transfer ownership to make someone the owner");
	assertOneOf(role, ["admin", "member"], "role"); //can't become owner for instance
	if (member_id === user_id) throw new DataError("You can't change your own role");

	await findGroupOr404(group_id);

	//We have to be an active owner to change roles
	await requireOwner(group_id, user_id, "Only the owner can change roles");

	//make sure we can find the member we're changing
	const target = await findMembership(group_id, member_id);
	if (target?.status !== "active") throw new NotFoundError("Member not found");

	return target.update({ role });
}

// One endpoint for every way a row goes away - which one it is comes from who's asking + the row's status:
//   self:        leave (active, not owner) / decline invite (invited) / cancel request (pending)
//   owner/admin: kick (active) / reject request (pending) / cancel invite (invited) / unban (banned)
//   ban = true:  owner/admin sets "banned" instead of deleting, so they can't rejoin

//Does the following:
// 1) We call this on ourself
// 2) Owner/admin can kick/reject/cancel invites. Can also ban/unban people
//kicking/rejecting = deleting row
//banning = keep row, but mark them as banned
async function removeMember(group_id, user_id, member_id, { ban = false } = {}) {
	await findGroupOr404(group_id);

	const target = await findMembership(group_id, member_id);
	if (!target) throw new NotFoundError("Member not found");

	//if called on self
	if (member_id === user_id) {
		if (ban) throw new DataError("You can't ban yourself");
		if (target.status === "banned") throw new NotFoundError("Group not found"); //otherwise a banned user could unban themselves

		if (target.role === "owner") {
			throw new ForbiddenError("Transfer ownership or delete the group before leaving");
		}
		return target.destroy(); //leave group
	}

	const membership = await requireManager(group_id, user_id, "Only the owner or an admin can remove members");

	//Owner can remove admins/members. Admins can remove members
	//pending / invited / banned rows are always "member"
	if (!outranks(membership.role, target.role)) throw new ForbiddenError("You can only remove people ranked below you");

	if (ban) {
		if (target.status === "banned") throw new ConflictError("This user is already banned");
		//role back to member so a banned ex-admin isn't still counted as an admin anywhere
		return target.update({ status: "banned", role: "member", invited_by: null });
	}

	return target.destroy();
}

//owner only. Old owner -> admin, new owner must be an active member.
async function transferOwnership(group_id, user_id, new_owner_id) {
	if (!Number.isInteger(new_owner_id)) throw new DataError("user_id is required");
	if (new_owner_id === user_id) throw new DataError("You already own this group");

	await findGroupOr404(group_id);

	const membership = await requireOwner(group_id, user_id, "Only the owner can transfer ownership");

	const target = await findMembership(group_id, new_owner_id);
	if (target?.status !== "active") throw new DataError("The new owner must be an active member");

	await sequelize.transaction(async (t) => {
		await membership.update({ role: "admin" }, { transaction: t });
		await target.update({ role: "owner" }, { transaction: t });
	});

	return getGroup(group_id, user_id); //we're now an admin instead of owner
}

module.exports = {
	getMyGroups,
	searchGroups,
	createGroup,
	getGroup,
	updateGroup,
	deleteGroup,
	joinGroup,
	inviteMember,
	acceptInvite,
	approveRequest,
	getMembers,
	updateMemberRole,
	removeMember,
	transferOwnership,
};
