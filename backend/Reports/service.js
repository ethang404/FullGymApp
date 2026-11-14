const { Op } = require("sequelize");
const {
	reports: reportsModel,
	posts: postsModel,
	post_comments: postCommentModel,
	users: userModel,
	groups: groupsModel,
	group_members: membersModel,
	food: foodModel,
} = require("../models/modelInits");
const sequelize = require("../models/db");
const { NotFoundError, DataError, ForbiddenError } = require("../error");

const { PUBLIC_USER_ATTRIBUTES, REPORT_TARGET_TYPES, REPORT_REASONS, REPORT_STATUSES } = require("../constants");
const { isBlocked } = require("../utils/social");
const { paginate } = require("../utils/pagination");
const { cleanText, assertOneOf } = require("../utils/validate");
const { findVisibleGroup } = require("../Groups/permissions");
const PostsService = require("../Posts/service");
const NutritionService = require("../Nutrition/service");

// Functions Reports/controller.js calls:
//
// createReport(user_id, is_guest, data)
//
// Admin only (Admin/route.js):
// getReports({ status, reported_user_id, cursor, limit })       -> { reports, next_cursor }
// resolveReport(report_id, status)                              -> report
// removeTarget(report_id)                                       -> report

//both people on a report, for the admin queue
const REPORT_USERS_INCLUDE = [
	{ model: userModel, as: "reporter", attributes: PUBLIC_USER_ATTRIBUTES },
	{ model: userModel, as: "reportedUser", attributes: PUBLIC_USER_ATTRIBUTES },
];

//what can be reported, keyed by target_type.
//  load   -> createReport: throws if the target is missing or the reporter can't see it. Otherwise returns who's
//            responsible for it + a snapshot of it. Failing the same way as a normal view means reporting by
//            guessing ids can't reveal private content
//  remove -> removeTarget: takes it down. Users have none, removing an account needs a ban feature first
const REPORT_TARGETS = {
	post: {
		load: async (id, reporter_id) => {
			//getPost does the visibility check, and its attachment is part of what the reporter saw
			const post = await PostsService.getPost(id, reporter_id);
			return { reported_user_id: post.user_id, snapshot: post };
		},
		remove: (id, transaction) => postsModel.destroy({ where: { id }, transaction }),
	},
	comment: {
		load: async (id, reporter_id) => {
			const comment = await postCommentModel.findByPk(id, {
				include: [{ model: userModel, attributes: PUBLIC_USER_ATTRIBUTES }],
			});
			//getComments hides blocked users' comments even on a post we can see
			if (!comment || (await isBlocked(reporter_id, comment.user_id))) throw new NotFoundError("Comment not found");

			await PostsService.getViewablePost(comment.post_id, reporter_id);
			return { reported_user_id: comment.user_id, snapshot: comment.toJSON() };
		},
		remove: (id, transaction) => postCommentModel.destroy({ where: { id }, transaction }),
	},
	user: {
		//no block check: someone harassing you is exactly who you'd have blocked
		load: async (id) => {
			const user = await userModel.findOne({ where: { user_id: id, is_guest: false }, attributes: PUBLIC_USER_ATTRIBUTES });
			if (!user) throw new NotFoundError("User not found");
			return { reported_user_id: user.user_id, snapshot: user.toJSON() };
		},
	},
	group: {
		load: async (id, reporter_id) => {
			const { group } = await findVisibleGroup(id, reporter_id);
			//the current owner, not created_by - ownership can be transferred
			const owner = await membersModel.findOne({ where: { group_id: id, role: "owner", status: "active" } });
			return { reported_user_id: owner?.user_id ?? null, snapshot: group.toJSON() };
		},
		remove: (id, transaction) => groupsModel.destroy({ where: { id }, transaction }),
	},
	food: {
		load: async (id) => {
			const food = await NutritionService.getFood(id); //404 if soft deleted
			return { reported_user_id: food.submitted_by, snapshot: food }; //null submitter for imported foods
		},
		//soft delete - hard deleting a food cascades into everyone's diary entries
		remove: (id, transaction) => foodModel.update({ is_deleted: true }, { where: { id }, transaction }),
	},
};

const MAX_INT = 2147483647; //biggest value a postgres INTEGER holds

//for ids from a body or query string. Out of range would be a postgres 500 instead of a 400
function assertValidId(value, label) {
	if (!Number.isInteger(value) || value < 1 || value > MAX_INT) throw new DataError(`${label} must be a valid id`);
}

// Body needs: { target_type, target_id, reason, note? }
//Reporting the same thing twice just keeps the first report, so the app can always say thanks
async function createReport(user_id, is_guest, data) {
	const { target_type, target_id, reason } = data;

	assertOneOf(target_type, REPORT_TARGET_TYPES, "target_type");
	assertValidId(target_id, "target_id");
	assertOneOf(reason, REPORT_REASONS, "reason");
	const note = cleanText(data.note, 500, "note"); //column is STRING(500)

	//foods are the only shared content guests can see
	if (is_guest && target_type !== "food") throw new ForbiddenError("Sign up for a full account to report this");

	const { reported_user_id, snapshot } = await REPORT_TARGETS[target_type].load(target_id, user_id);

	//optional: nothing breaks if someone reports themselves, it's just noise in the queue
	if (reported_user_id === user_id) throw new DataError("You can't report yourself");

	await reportsModel.findOrCreate({
		where: { reporter_id: user_id, target_type, target_id },
		defaults: { reported_user_id, reason, note, content_snapshot: snapshot },
	});
}

async function findReportOr404(report_id) {
	const report = await reportsModel.findByPk(report_id);
	if (!report) throw new NotFoundError("Report not found");
	return report;
}

//oldest first, so the longest waiting report is at the top.
//status defaults to the open queue. status=all + reported_user_id gives someone's whole history
async function getReports({ status = "open", reported_user_id, cursor, limit }) {
	assertOneOf(status, [...REPORT_STATUSES, "all"], "status");

	const where = status === "all" ? {} : { status };
	if (reported_user_id !== undefined) {
		const id = Number(reported_user_id);
		assertValidId(id, "reported_user_id");
		where.reported_user_id = id;
	}

	const { rows: reports, next_cursor } = await paginate(reportsModel, {
		where,
		include: REPORT_USERS_INCLUDE,
		cursor,
		limit,
		newest_first: false,
	});
	return { reports, next_cursor };
}

//"open" reopens a report resolved by mistake
async function resolveReport(report_id, status) {
	assertOneOf(status, REPORT_STATUSES, "status");

	const report = await findReportOr404(report_id);
	return report.update({ status, resolved_at: status === "open" ? null : new Date() });
}

//Takes the content down and closes every report on it, not just this one.
//Fine to call if the target is already gone, the reports still get closed
async function removeTarget(report_id) {
	const report = await findReportOr404(report_id);
	const { target_type, target_id } = report;

	const { remove } = REPORT_TARGETS[target_type];
	if (!remove) throw new DataError("Accounts can't be removed from a report");

	await sequelize.transaction(async (t) => {
		await remove(target_id, t);
		await reportsModel.update(
			{ status: "actioned", resolved_at: new Date() },
			{ where: { target_type, target_id, status: { [Op.ne]: "actioned" } }, transaction: t },
		);
	});

	return report.reload();
}

module.exports = { createReport, getReports, resolveReport, removeTarget };
