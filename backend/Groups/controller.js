const service = require("./service");
const postsService = require("../Posts/service");

// ---------------------------------------------
// Groups
// ---------------------------------------------

async function getMyGroups(req, res) {
	const groups = await service.getMyGroups(req.user_id); //{ active: [...], invited: [...] }
	return res.status(200).json({ groups });
}

// /groups?search=lifting
async function searchGroups(req, res) {
	const { search } = req.query;
	const groups = await service.searchGroups(req.user_id, search);
	return res.status(200).json({ groups });
}

// Body needs: { name, description?, join_policy? }
async function createGroup(req, res) {
	const group = await service.createGroup(req.user_id, req.body);
	return res.status(201).json({ group });
}

async function getGroup(req, res) {
	const group_id = parseInt(req.params.id, 10);
	const group = await service.getGroup(group_id, req.user_id);
	return res.status(200).json({ group });
}

// Body: { name?, description?, join_policy? }
async function updateGroup(req, res) {
	const group_id = parseInt(req.params.id, 10);
	const group = await service.updateGroup(group_id, req.user_id, req.body);
	return res.status(200).json({ group });
}

async function deleteGroup(req, res) {
	const group_id = parseInt(req.params.id, 10);
	await service.deleteGroup(group_id, req.user_id);
	return res.status(200).json({ message: "Group deleted" });
}

// ---------------------------------------------
// Membership
// ---------------------------------------------

async function joinGroup(req, res) {
	const group_id = parseInt(req.params.id, 10);
	const membership = await service.joinGroup(group_id, req.user_id); //status tells the frontend joined vs requested
	return res.status(201).json({ membership });
}

// Body needs: { user_id } - who to invite
async function inviteMember(req, res) {
	const group_id = parseInt(req.params.id, 10);
	const { user_id: invitee_id } = req.body;
	const membership = await service.inviteMember(group_id, req.user_id, invitee_id);
	return res.status(201).json({ membership });
}

async function acceptInvite(req, res) {
	const group_id = parseInt(req.params.id, 10);
	const membership = await service.acceptInvite(group_id, req.user_id);
	return res.status(200).json({ membership });
}

async function approveRequest(req, res) {
	const group_id = parseInt(req.params.id, 10);
	const member_id = parseInt(req.params.user_id, 10);
	const membership = await service.approveRequest(group_id, req.user_id, member_id);
	return res.status(200).json({ membership });
}

async function getMembers(req, res) {
	const group_id = parseInt(req.params.id, 10);
	const members = await service.getMembers(group_id, req.user_id);
	return res.status(200).json({ members });
}

// Body needs: { role }
async function updateMemberRole(req, res) {
	const group_id = parseInt(req.params.id, 10);
	const member_id = parseInt(req.params.user_id, 10);
	const { role } = req.body;
	const membership = await service.updateMemberRole(group_id, req.user_id, member_id, role);
	return res.status(200).json({ membership });
}

//leave / kick / decline invite / reject or cancel request / unban - service decides which from who's asking + the row's status
// ?ban=true -> owner/admin bans instead of removing
async function removeMember(req, res) {
	const group_id = parseInt(req.params.id, 10);
	const member_id = parseInt(req.params.user_id, 10);
	const ban = req.query.ban === "true";
	await service.removeMember(group_id, req.user_id, member_id, { ban });
	return res.status(200).json({ message: ban ? "Member banned" : "Member removed" });
}

// Body needs: { user_id } - the new owner (must be an active member)
async function transferOwnership(req, res) {
	const group_id = parseInt(req.params.id, 10);
	const { user_id: new_owner_id } = req.body;
	const group = await service.transferOwnership(group_id, req.user_id, new_owner_id);
	return res.status(200).json({ group });
}

// ---------------------------------------------
// Group feed -- lives in Posts area
// ---------------------------------------------

// /groups/:id/posts?cursor=...&limit=20
async function getGroupPosts(req, res) {
	const group_id = parseInt(req.params.id, 10);
	const { cursor, limit } = req.query;
	const feed = await postsService.getGroupFeed(group_id, req.user_id, { cursor, limit }); //{ posts, next_cursor }
	return res.status(200).json(feed);
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
	getGroupPosts,
};
