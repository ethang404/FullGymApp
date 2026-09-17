const { Op } = require("sequelize");
const { recipe: RecipeModel, recipeIngredient: RecipeIngredientModel, workouts: WorkoutsModel, users: UsersModel } = require("../models/modelInits");
const { DataError } = require("../error");
const { getFriendIds } = require("../utils/friendship");
const { serializeRecipeSummary } = require("../Nutrition/service");

const TYPES = ["recipe", "workout", "all"];
const SCOPES = ["all", "friends", "public", "mine"];
const USER_ATTRS = ["user_id", "user_name"];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function encodeCursor(date) {
	return Buffer.from(date.toISOString()).toString("base64");
}

function decodeCursor(cursor) {
	const iso = Buffer.from(String(cursor), "base64").toString("utf8");
	const date = new Date(iso);
	if (isNaN(date.getTime())) throw new DataError("Invalid cursor");
	return date;
}

// Builds the same "what am I allowed to see" WHERE clause for either content table,
// scoped by the caller's chosen `scope` filter.
function buildVisibilityWhere(user_id, friendIds, scope) {
	if (scope === "mine") return { user_id };
	if (scope === "public") return { visibility: "public" };
	// friendIds is empty for a brand-new user with no friends yet - Op.in: [] matches nothing in
	// Postgres, but pass a sentinel anyway so the intent reads clearly rather than relying on that.
	const friendVisible = { visibility: "friends", user_id: { [Op.in]: friendIds.length ? friendIds : [-1] } };
	if (scope === "friends") return friendVisible;

	// scope === "all": everything the caller is allowed to see at all - own content
	// (any visibility) + public content from anyone + friends-visible content from friends.
	return { [Op.or]: [{ user_id }, { visibility: "public" }, friendVisible] };
}

async function queryRecipes({ user_id, friendIds, scope, search, cursor, limit }) {
	const and = [buildVisibilityWhere(user_id, friendIds, scope)];
	if (cursor) and.push({ createdAt: { [Op.lt]: cursor } });
	if (search) and.push({ name: { [Op.iLike]: `%${search}%` } });

	const rows = await RecipeModel.findAll({
		where: { [Op.and]: and },
		include: [
			{ model: RecipeIngredientModel, required: false },
			{ model: UsersModel, attributes: USER_ATTRS },
		],
		order: [
			["createdAt", "DESC"],
			["recipe_id", "DESC"],
		],
		limit,
	});

	return rows.map((r) => {
		const summary = serializeRecipeSummary(r);
		return {
			type: "recipe",
			id: summary.id,
			name: summary.name,
			visibility: summary.visibility,
			created_at: r.createdAt,
			user_id: r.user_id,
			user_name: r.user?.user_name ?? null,
			servings: summary.servings,
			calories_per_serving: summary.calories_per_serving,
			protein_per_serving: summary.protein_per_serving,
			carbs_per_serving: summary.carbs_per_serving,
			fat_per_serving: summary.fat_per_serving,
		};
	});
}

async function queryWorkouts({ user_id, friendIds, scope, search, cursor, limit }) {
	const and = [buildVisibilityWhere(user_id, friendIds, scope)];
	if (cursor) and.push({ createdAt: { [Op.lt]: cursor } });
	if (search) and.push({ name: { [Op.iLike]: `%${search}%` } });

	const rows = await WorkoutsModel.findAll({
		where: { [Op.and]: and },
		include: [{ model: UsersModel, attributes: USER_ATTRS }],
		order: [
			["createdAt", "DESC"],
			["workout_id", "DESC"],
		],
		limit,
	});

	return rows.map((w) => ({
		type: "workout",
		id: w.workout_id,
		name: w.name,
		visibility: w.visibility,
		created_at: w.createdAt,
		user_id: w.user_id,
		user_name: w.user?.user_name ?? null,
		workout_date: w.workout_date,
		notes: w.notes,
	}));
}

/**
 * GET /explore?type=recipe|workout|all&scope=all|friends|public|mine&search=&cursor=&limit=20
 * Combined, cursor-paginated feed of recipes + workouts the caller is allowed to see.
 */
async function getExploreFeed(user_id, { type = "all", scope = "all", search, cursor, limit } = {}) {
	type = type || "all";
	scope = scope || "all";
	if (!TYPES.includes(type)) throw new DataError("type must be 'recipe', 'workout', or 'all'");
	if (!SCOPES.includes(scope)) throw new DataError("scope must be 'all', 'friends', 'public', or 'mine'");

	limit = Math.min(parseInt(limit, 10) || DEFAULT_LIMIT, MAX_LIMIT);
	const decodedCursor = cursor ? decodeCursor(cursor) : null;

	// Only 'all'/'friends' scopes actually reference the friend list.
	const friendIds = scope === "mine" || scope === "public" ? [] : await getFriendIds(user_id);

	// Fetch limit+1 from each side so we can tell whether there's more beyond this page without
	// the off-by-one ambiguity of "got exactly `limit` rows back - is that all of them, or not?"
	const fetchLimit = limit + 1;
	const [recipes, workouts] = await Promise.all([
		type === "workout" ? [] : queryRecipes({ user_id, friendIds, scope, search, cursor: decodedCursor, limit: fetchLimit }),
		type === "recipe" ? [] : queryWorkouts({ user_id, friendIds, scope, search, cursor: decodedCursor, limit: fetchLimit }),
	]);

	// Merge the two per-type pools by recency and take the true top `limit` - fetching limit+1
	// from EACH side before merging guarantees the correct global top-`limit` slice, since the
	// real top-`limit` merged result can never draw more than `limit` items from either source.
	const pool = [...recipes, ...workouts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
	const items = pool.slice(0, limit);
	const hasMore = pool.length > limit;
	const next_cursor = hasMore ? encodeCursor(new Date(items[items.length - 1].created_at)) : null;

	return { items, next_cursor };
}

module.exports = { getExploreFeed };
