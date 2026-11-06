const {
	reports: reportsModel,
	posts: postsModel,
	post_comments: postCommentModel,
	users: userModel,
	groups: groupsModel,
	group_members: membersModel,
	food: foodModel,
} = require("../models/modelInits");
const { NotFoundError, DataError, ForbiddenError } = require("../error");

const { PUBLIC_USER_ATTRIBUTES, REPORT_TARGET_TYPES, REPORT_REASONS } = require("../constants");
const { isBlocked } = require("../utils/social");
const { cleanText, assertOneOf } = require("../utils/validate");
const { findVisibleGroup } = require("../Groups/permissions");
const PostsService = require("../Posts/service");
const NutritionService = require("../Nutrition/service");

// Functions Reports/controller.js calls:
//
// createReport(user_id, is_guest, data)

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

module.exports = { createReport };
