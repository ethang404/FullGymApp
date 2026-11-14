const request = require("supertest");
const sequelize = require("../models/db");
const {
	reports: ReportsModel,
	posts: PostsModel,
	post_comments: CommentsModel,
	groups: GroupsModel,
	food: FoodModel,
	diaryEntries: DiaryEntriesModel,
	blocked_users: BlockedModel,
} = require("../models/modelInits");
const { app, registerUser, createGuest, bearer, createWorkout, createGroup, tick } = require("./SocialHelpers");

let admin;

// sync({force:true}) rebuilds every table - extended timeout, same as the other suites
beforeAll(async () => {
	await sequelize.sync({ force: true });
	admin = await registerUser("admin");
	process.env.ADMIN_USER_IDS = `${admin.id}`;
}, 30000);

afterAll(async () => {
	delete process.env.ADMIN_USER_IDS;
	await sequelize.close();
});

const report = (user, body) => request(app).post("/reports").set(bearer(user)).send(body);
const listReports = (user, query = "") => request(app).get(`/admin/reports${query}`).set(bearer(user));
const resolve = (user, id, status) => request(app).patch(`/admin/reports/${id}`).set(bearer(user)).send({ status });
const removeTarget = (user, id) => request(app).post(`/admin/reports/${id}/remove-target`).set(bearer(user));
const deleteAccount = (user) => request(app).delete("/users/me").set(bearer(user));
const findReport = (reporter, target_type, target_id) => ReportsModel.findOne({ where: { reporter_id: reporter.id, target_type, target_id } });

//public post sharing a fresh workout of the author's
async function publicPost(user, caption = "PR day") {
	const workout = await createWorkout(user);
	const resp = await request(app).post("/posts").set(bearer(user)).send({ workout_id: workout.workout_id, caption });
	return resp.body.post;
}

async function addComment(user, post, body = "nice") {
	const resp = await request(app).post(`/posts/${post.id}/comments`).set(bearer(user)).send({ body });
	return resp.body.comment;
}

function createFood(submitter, name = "Protein bar") {
	return FoodModel.create({ name, source: submitter ? "user_submitted" : "usda", submitted_by: submitter?.id ?? null });
}

// ─────────────────────────────────────────────
// POST /reports
// ─────────────────────────────────────────────

describe("POST /reports", () => {
	test("reporting a post saves who's responsible and a snapshot, including its attachment", async () => {
		const author = await registerUser("author");
		const reporter = await registerUser("reporter");
		const post = await publicPost(author, "bad caption");

		const resp = await report(reporter, { target_type: "post", target_id: post.id, reason: "spam", note: "  buy my stuff  " });
		expect(resp.status).toBe(201);

		const row = await findReport(reporter, "post", post.id);
		expect(row.reported_user_id).toBe(author.id);
		expect(row.reason).toBe("spam");
		expect(row.note).toBe("buy my stuff");
		expect(row.status).toBe("open");
		expect(row.content_snapshot.caption).toBe("bad caption");
		expect(row.content_snapshot.attachment_type).toBe("workout");
		expect(row.content_snapshot.attachment.workout_name).toBe("Push day");
	});

	test("comment, user and group can all be reported", async () => {
		const author = await registerUser("author");
		const reporter = await registerUser("reporter");
		const post = await publicPost(reporter);
		const comment = await addComment(author, post, "rude comment");
		const group = await createGroup(author, { name: "Bad group" });

		expect((await report(reporter, { target_type: "comment", target_id: comment.id, reason: "harassment" })).status).toBe(201);
		expect((await report(reporter, { target_type: "user", target_id: author.id, reason: "harassment" })).status).toBe(201);
		expect((await report(reporter, { target_type: "group", target_id: group.id, reason: "hate" })).status).toBe(201);

		const comment_report = await findReport(reporter, "comment", comment.id);
		expect(comment_report.reported_user_id).toBe(author.id);
		expect(comment_report.content_snapshot.body).toBe("rude comment");
		expect(comment_report.content_snapshot.user.user_name).toBe(author.userName);

		const user_report = await findReport(reporter, "user", author.id);
		expect(user_report.content_snapshot.user_name).toBe(author.userName);

		const group_report = await findReport(reporter, "group", group.id);
		expect(group_report.reported_user_id).toBe(author.id);
		expect(group_report.content_snapshot.name).toBe("Bad group");
	});

	test("a user snapshot only holds public fields", async () => {
		const target = await registerUser("target");
		const reporter = await registerUser("reporter");

		await report(reporter, { target_type: "user", target_id: target.id, reason: "other" });

		const row = await findReport(reporter, "user", target.id);
		expect(Object.keys(row.content_snapshot).sort()).toEqual(["first_name", "last_name", "user_id", "user_name"]);
	});

	test("a group report points at the current owner, not whoever created it", async () => {
		const creator = await registerUser("creator");
		const new_owner = await registerUser("newowner");
		const reporter = await registerUser("reporter");
		const group = await createGroup(creator);

		await request(app).post(`/groups/${group.id}/join`).set(bearer(new_owner));
		await request(app).post(`/groups/${group.id}/transfer-ownership`).set(bearer(creator)).send({ user_id: new_owner.id });

		await report(reporter, { target_type: "group", target_id: group.id, reason: "other" });
		expect((await findReport(reporter, "group", group.id)).reported_user_id).toBe(new_owner.id);
	});

	test("reporting twice succeeds but keeps the first report", async () => {
		const author = await registerUser("author");
		const reporter = await registerUser("reporter");
		const post = await publicPost(author);

		await report(reporter, { target_type: "post", target_id: post.id, reason: "spam" });
		const second = await report(reporter, { target_type: "post", target_id: post.id, reason: "hate" });
		expect(second.status).toBe(201);

		const rows = await ReportsModel.findAll({ where: { reporter_id: reporter.id, target_type: "post", target_id: post.id } });
		expect(rows).toHaveLength(1);
		expect(rows[0].reason).toBe("spam");
	});

	test("two people can report the same thing", async () => {
		const author = await registerUser("author");
		const first = await registerUser("reporter");
		const second = await registerUser("reporter");
		const post = await publicPost(author);

		await report(first, { target_type: "post", target_id: post.id, reason: "spam" });
		await report(second, { target_type: "post", target_id: post.id, reason: "spam" });

		expect(await ReportsModel.count({ where: { target_type: "post", target_id: post.id } })).toBe(2);
	});

	test("bad input -> 400, not a postgres 500", async () => {
		const reporter = await registerUser("reporter");
		const target = await registerUser("target");
		const valid = { target_type: "user", target_id: target.id, reason: "spam" };

		expect((await report(reporter, {})).status).toBe(400);
		expect((await report(reporter, { ...valid, target_type: "workout" })).status).toBe(400);
		expect((await report(reporter, { ...valid, target_type: "__proto__" })).status).toBe(400);
		expect((await report(reporter, { ...valid, target_id: "abc" })).status).toBe(400);
		expect((await report(reporter, { ...valid, target_id: 0 })).status).toBe(400);
		expect((await report(reporter, { ...valid, target_id: 99999999999 })).status).toBe(400);
		expect((await report(reporter, { ...valid, reason: "because" })).status).toBe(400);
		expect((await report(reporter, { ...valid, note: "x".repeat(501) })).status).toBe(400);
	});

	test("no body at all -> 400", async () => {
		const reporter = await registerUser("reporter");
		const resp = await request(app).post("/reports").set(bearer(reporter));
		expect(resp.status).toBe(400);
	});

	test("no token -> 401", async () => {
		const resp = await request(app).post("/reports").send({ target_type: "user", target_id: 1, reason: "spam" });
		expect(resp.status).toBe(401);
	});

	test("something that doesn't exist -> 404 and nothing saved", async () => {
		const reporter = await registerUser("reporter");

		for (const target_type of ["post", "comment", "user", "group", "food"]) {
			expect((await report(reporter, { target_type, target_id: 999999, reason: "spam" })).status).toBe(404);
		}
		expect(await ReportsModel.count({ where: { reporter_id: reporter.id } })).toBe(0);
	});

	test("reporting yourself or your own content -> 400", async () => {
		const user = await registerUser("user");
		const post = await publicPost(user);
		const food = await createFood(user);

		expect((await report(user, { target_type: "user", target_id: user.id, reason: "spam" })).status).toBe(400);
		expect((await report(user, { target_type: "post", target_id: post.id, reason: "spam" })).status).toBe(400);
		expect((await report(user, { target_type: "food", target_id: food.id, reason: "spam" })).status).toBe(400);
	});

	describe("can't report what you can't see", () => {
		test("a group post or a comment on it, when not in the group -> 403", async () => {
			const owner = await registerUser("owner");
			const outsider = await registerUser("outsider");
			const group = await createGroup(owner);
			const workout = await createWorkout(owner);
			const created = await request(app)
				.post("/posts")
				.set(bearer(owner))
				.send({ visibility: "group", group_id: group.id, workout_id: workout.workout_id });
			const post = created.body.post;
			const comment = await addComment(owner, post);

			expect((await report(outsider, { target_type: "post", target_id: post.id, reason: "spam" })).status).toBe(403);
			expect((await report(outsider, { target_type: "comment", target_id: comment.id, reason: "spam" })).status).toBe(403);
			expect(await ReportsModel.count({ where: { reporter_id: outsider.id } })).toBe(0);
		});

		test("a blocked user's post or comment -> 404", async () => {
			const author = await registerUser("author");
			const commenter = await registerUser("commenter");
			const reporter = await registerUser("reporter");
			const post = await publicPost(author);
			const blocked_post = await publicPost(commenter);
			const comment = await addComment(commenter, post);
			await BlockedModel.create({ blocker_id: commenter.id, blocked_user_id: reporter.id });

			expect((await report(reporter, { target_type: "post", target_id: blocked_post.id, reason: "spam" })).status).toBe(404);
			expect((await report(reporter, { target_type: "comment", target_id: comment.id, reason: "spam" })).status).toBe(404);
		});

		test("a group you're banned from -> 404", async () => {
			const owner = await registerUser("owner");
			const banned = await registerUser("banned");
			const group = await createGroup(owner);
			await request(app).post(`/groups/${group.id}/join`).set(bearer(banned));
			await request(app).delete(`/groups/${group.id}/members/${banned.id}?ban=true`).set(bearer(owner));

			expect((await report(banned, { target_type: "group", target_id: group.id, reason: "other" })).status).toBe(404);
		});

		test("a soft deleted food -> 404", async () => {
			const reporter = await registerUser("reporter");
			const food = await createFood(null);
			await food.update({ is_deleted: true });

			expect((await report(reporter, { target_type: "food", target_id: food.id, reason: "spam" })).status).toBe(404);
		});

		test("a guest account can't be reported as a user", async () => {
			const reporter = await registerUser("reporter");
			const guest = await createGuest();

			expect((await report(reporter, { target_type: "user", target_id: guest.id, reason: "spam" })).status).toBe(404);
		});
	});

	test("a user you've blocked can still be reported", async () => {
		const harasser = await registerUser("harasser");
		const reporter = await registerUser("reporter");
		await BlockedModel.create({ blocker_id: reporter.id, blocked_user_id: harasser.id });

		expect((await report(reporter, { target_type: "user", target_id: harasser.id, reason: "harassment" })).status).toBe(201);
	});

	describe("foods", () => {
		test("a submitted food points at its submitter", async () => {
			const submitter = await registerUser("submitter");
			const reporter = await registerUser("reporter");
			const food = await createFood(submitter, "Rude food name");

			expect((await report(reporter, { target_type: "food", target_id: food.id, reason: "hate" })).status).toBe(201);

			const row = await findReport(reporter, "food", food.id);
			expect(row.reported_user_id).toBe(submitter.id);
			expect(row.content_snapshot.name).toBe("Rude food name");
		});

		test("an imported food has nobody to point at", async () => {
			const reporter = await registerUser("reporter");
			const food = await createFood(null);

			expect((await report(reporter, { target_type: "food", target_id: food.id, reason: "other" })).status).toBe(201);
			expect((await findReport(reporter, "food", food.id)).reported_user_id).toBeNull();
		});
	});

	describe("guests", () => {
		test("can report a food", async () => {
			const guest = await createGuest();
			const food = await createFood(null);

			expect((await report(guest, { target_type: "food", target_id: food.id, reason: "spam" })).status).toBe(201);
		});

		test("can't report anything else", async () => {
			const guest = await createGuest();
			const author = await registerUser("author");
			const post = await publicPost(author);

			expect((await report(guest, { target_type: "post", target_id: post.id, reason: "spam" })).status).toBe(403);
			expect((await report(guest, { target_type: "user", target_id: author.id, reason: "spam" })).status).toBe(403);
		});
	});
});

// ─────────────────────────────────────────────
// Reports outlive what they point at
// ─────────────────────────────────────────────

describe("reports survive deletion", () => {
	test("deleting the post keeps the report and what the post said", async () => {
		const author = await registerUser("author");
		const reporter = await registerUser("reporter");
		const post = await publicPost(author, "delete me quick");
		await report(reporter, { target_type: "post", target_id: post.id, reason: "hate" });

		const deleted = await request(app).delete(`/posts/${post.id}`).set(bearer(author));
		expect(deleted.status).toBe(200);

		const row = await findReport(reporter, "post", post.id);
		expect(row.status).toBe("open");
		expect(row.content_snapshot.caption).toBe("delete me quick");
	});

	test("editing the post afterwards doesn't change the snapshot", async () => {
		const author = await registerUser("author");
		const reporter = await registerUser("reporter");
		const post = await publicPost(author, "the original");
		await report(reporter, { target_type: "post", target_id: post.id, reason: "hate" });

		await request(app).patch(`/posts/${post.id}`).set(bearer(author)).send({ caption: "cleaned up" });

		expect((await findReport(reporter, "post", post.id)).content_snapshot.caption).toBe("the original");
	});

	test("the reported user deleting their account keeps the report without the link", async () => {
		const author = await registerUser("author");
		const reporter = await registerUser("reporter");
		const post = await publicPost(author, "gone soon");
		await report(reporter, { target_type: "post", target_id: post.id, reason: "hate" });

		expect((await deleteAccount(author)).status).toBe(200);

		const row = await findReport(reporter, "post", post.id);
		expect(row.reported_user_id).toBeNull();
		expect(row.content_snapshot.caption).toBe("gone soon");
	});

	test("the reporter deleting their account keeps the report without the link", async () => {
		const author = await registerUser("author");
		const reporter = await registerUser("reporter");
		const post = await publicPost(author);
		await report(reporter, { target_type: "post", target_id: post.id, reason: "hate" });

		expect((await deleteAccount(reporter)).status).toBe(200);

		const row = await ReportsModel.findOne({ where: { target_type: "post", target_id: post.id } });
		expect(row.reporter_id).toBeNull();
		expect(row.reported_user_id).toBe(author.id);
	});

	test("two reporters who both deleted their accounts don't clash on the unique index", async () => {
		const author = await registerUser("author");
		const first = await registerUser("reporter");
		const second = await registerUser("reporter");
		const post = await publicPost(author);
		await report(first, { target_type: "post", target_id: post.id, reason: "spam" });
		await report(second, { target_type: "post", target_id: post.id, reason: "spam" });

		expect((await deleteAccount(first)).status).toBe(200);
		expect((await deleteAccount(second)).status).toBe(200);

		expect(await ReportsModel.count({ where: { target_type: "post", target_id: post.id } })).toBe(2);
	});
});

// ─────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────

describe("/admin", () => {
	test("anyone not in ADMIN_USER_IDS -> 403 on every route", async () => {
		const user = await registerUser("user");

		expect((await listReports(user)).status).toBe(403);
		expect((await resolve(user, 1, "dismissed")).status).toBe(403);
		expect((await removeTarget(user, 1)).status).toBe(403);
	});

	test("a guest -> 403", async () => {
		const guest = await createGuest();
		expect((await listReports(guest)).status).toBe(403);
	});

	test("no ADMIN_USER_IDS set -> nobody is an admin", async () => {
		const saved = process.env.ADMIN_USER_IDS;
		delete process.env.ADMIN_USER_IDS;

		try {
			expect((await listReports(admin)).status).toBe(403);
		} finally {
			process.env.ADMIN_USER_IDS = saved;
		}
	});

	test("no token -> 401", async () => {
		expect((await request(app).get("/admin/reports")).status).toBe(401);
		expect((await request(app).post("/admin/reports/1/remove-target")).status).toBe(401);
	});

	test("a path that doesn't exist is still behind the check", async () => {
		const user = await registerUser("user");

		expect((await request(app).get("/admin/nope")).status).toBe(401);
		expect((await request(app).get("/admin/nope").set(bearer(user))).status).toBe(403);
	});

	test("the queue isn't reachable from /reports", async () => {
		expect((await request(app).get("/reports").set(bearer(admin))).status).toBe(404);
	});

	describe("GET /admin/reports", () => {
		test("open queue is oldest first, with both people attached", async () => {
			const author = await registerUser("author");
			const reporter = await registerUser("reporter");
			const older = await publicPost(author);
			const newer = await publicPost(author);
			await report(reporter, { target_type: "post", target_id: older.id, reason: "spam" });
			await tick();
			await report(reporter, { target_type: "post", target_id: newer.id, reason: "spam" });

			const resp = await listReports(admin, `?reported_user_id=${author.id}`);
			expect(resp.status).toBe(200);
			expect(resp.body.reports.map((row) => row.target_id)).toEqual([older.id, newer.id]);
			expect(resp.body.reports[0].reporter.user_name).toBe(reporter.userName);
			expect(resp.body.reports[0].reportedUser.user_name).toBe(author.userName);
			expect(resp.body.reports[0].reporter.password).toBeUndefined();
		});

		test("pages with a cursor", async () => {
			const author = await registerUser("author");
			const reporter = await registerUser("reporter");
			const first = await publicPost(author);
			const second = await publicPost(author);
			await report(reporter, { target_type: "post", target_id: first.id, reason: "spam" });
			await tick();
			await report(reporter, { target_type: "post", target_id: second.id, reason: "spam" });

			const page_one = await listReports(admin, `?reported_user_id=${author.id}&limit=1`);
			expect(page_one.body.reports[0].target_id).toBe(first.id);

			const cursor = encodeURIComponent(page_one.body.next_cursor);
			const page_two = await listReports(admin, `?reported_user_id=${author.id}&limit=1&cursor=${cursor}`);
			expect(page_two.body.reports[0].target_id).toBe(second.id);
			expect(page_two.body.next_cursor).toBeNull();
		});

		test("resolved reports leave the open queue, status=all still shows them", async () => {
			const author = await registerUser("author");
			const reporter = await registerUser("reporter");
			const post = await publicPost(author);
			await report(reporter, { target_type: "post", target_id: post.id, reason: "spam" });
			const row = await findReport(reporter, "post", post.id);
			await resolve(admin, row.id, "dismissed");

			expect((await listReports(admin, `?reported_user_id=${author.id}`)).body.reports).toHaveLength(0);
			expect((await listReports(admin, `?reported_user_id=${author.id}&status=dismissed`)).body.reports).toHaveLength(1);
			expect((await listReports(admin, `?reported_user_id=${author.id}&status=all`)).body.reports).toHaveLength(1);
		});

		test("bad filters -> 400", async () => {
			expect((await listReports(admin, "?status=nope")).status).toBe(400);
			expect((await listReports(admin, "?reported_user_id=abc")).status).toBe(400);
			expect((await listReports(admin, "?cursor=notadate")).status).toBe(400);
		});
	});

	describe("PATCH /admin/reports/:id", () => {
		async function openReport() {
			const author = await registerUser("author");
			const reporter = await registerUser("reporter");
			const post = await publicPost(author);
			await report(reporter, { target_type: "post", target_id: post.id, reason: "spam" });
			return { row: await findReport(reporter, "post", post.id), post };
		}

		test("resolving sets resolved_at and leaves the content alone", async () => {
			const { row, post } = await openReport();

			const resp = await resolve(admin, row.id, "dismissed");
			expect(resp.status).toBe(200);
			expect(resp.body.report.status).toBe("dismissed");
			expect(resp.body.report.resolved_at).not.toBeNull();
			expect(await PostsModel.findByPk(post.id)).not.toBeNull();
		});

		test("reopening clears resolved_at", async () => {
			const { row } = await openReport();
			await resolve(admin, row.id, "dismissed");

			const resp = await resolve(admin, row.id, "open");
			expect(resp.body.report.status).toBe("open");
			expect(resp.body.report.resolved_at).toBeNull();
		});

		test("bad status -> 400, missing body -> 400, unknown report -> 404, bad id -> 400", async () => {
			const { row } = await openReport();

			expect((await resolve(admin, row.id, "nope")).status).toBe(400);
			expect((await request(app).patch(`/admin/reports/${row.id}`).set(bearer(admin))).status).toBe(400);
			expect((await resolve(admin, 999999, "dismissed")).status).toBe(404);
			expect((await resolve(admin, "abc", "dismissed")).status).toBe(400);
		});
	});

	describe("POST /admin/reports/:id/remove-target", () => {
		test("removes a post and closes every report on it, even a dismissed one", async () => {
			const author = await registerUser("author");
			const first = await registerUser("reporter");
			const second = await registerUser("reporter");
			const post = await publicPost(author);
			await report(first, { target_type: "post", target_id: post.id, reason: "spam" });
			await report(second, { target_type: "post", target_id: post.id, reason: "hate" });
			const first_row = await findReport(first, "post", post.id);
			const second_row = await findReport(second, "post", post.id);
			await resolve(admin, second_row.id, "dismissed");

			const resp = await removeTarget(admin, first_row.id);
			expect(resp.status).toBe(200);
			expect(resp.body.report.status).toBe("actioned");

			expect(await PostsModel.findByPk(post.id)).toBeNull();
			await second_row.reload();
			expect(second_row.status).toBe("actioned");
			expect(second_row.resolved_at).not.toBeNull();
		});

		test("leaves reports on other targets alone", async () => {
			const author = await registerUser("author");
			const reporter = await registerUser("reporter");
			const removed = await publicPost(author);
			const kept = await publicPost(author);
			await report(reporter, { target_type: "post", target_id: removed.id, reason: "spam" });
			await report(reporter, { target_type: "post", target_id: kept.id, reason: "spam" });

			await removeTarget(admin, (await findReport(reporter, "post", removed.id)).id);

			expect((await findReport(reporter, "post", kept.id)).status).toBe("open");
			expect(await PostsModel.findByPk(kept.id)).not.toBeNull();
		});

		test("removes a comment but not its post", async () => {
			const author = await registerUser("author");
			const reporter = await registerUser("reporter");
			const post = await publicPost(reporter);
			const comment = await addComment(author, post);
			await report(reporter, { target_type: "comment", target_id: comment.id, reason: "hate" });

			await removeTarget(admin, (await findReport(reporter, "comment", comment.id)).id);

			expect(await CommentsModel.findByPk(comment.id)).toBeNull();
			expect(await PostsModel.findByPk(post.id)).not.toBeNull();
		});

		test("removes a group", async () => {
			const owner = await registerUser("owner");
			const reporter = await registerUser("reporter");
			const group = await createGroup(owner);
			await report(reporter, { target_type: "group", target_id: group.id, reason: "hate" });

			await removeTarget(admin, (await findReport(reporter, "group", group.id)).id);

			expect(await GroupsModel.findByPk(group.id)).toBeNull();
		});

		test("a food is soft deleted, so diary entries that use it survive", async () => {
			const submitter = await registerUser("submitter");
			const reporter = await registerUser("reporter");
			const food = await createFood(submitter);
			const entry = await DiaryEntriesModel.create({
				user_id: reporter.id,
				food_id: food.id,
				meal_type: "breakfast",
				logged_at: "2026-10-01",
				quantity: 50,
				unit: "g",
			});
			await report(reporter, { target_type: "food", target_id: food.id, reason: "hate" });

			const resp = await removeTarget(admin, (await findReport(reporter, "food", food.id)).id);
			expect(resp.status).toBe(200);

			await food.reload();
			expect(food.is_deleted).toBe(true);
			expect(await DiaryEntriesModel.findByPk(entry.id)).not.toBeNull();
		});

		test("a user can't be removed this way -> 400, report stays open", async () => {
			const target = await registerUser("target");
			const reporter = await registerUser("reporter");
			await report(reporter, { target_type: "user", target_id: target.id, reason: "hate" });
			const row = await findReport(reporter, "user", target.id);

			expect((await removeTarget(admin, row.id)).status).toBe(400);

			await row.reload();
			expect(row.status).toBe("open");
		});

		test("content that's already gone still closes the report", async () => {
			const author = await registerUser("author");
			const reporter = await registerUser("reporter");
			const post = await publicPost(author);
			await report(reporter, { target_type: "post", target_id: post.id, reason: "hate" });
			await request(app).delete(`/posts/${post.id}`).set(bearer(author));

			const resp = await removeTarget(admin, (await findReport(reporter, "post", post.id)).id);
			expect(resp.status).toBe(200);
			expect(resp.body.report.status).toBe("actioned");
		});

		test("unknown report -> 404", async () => {
			expect((await removeTarget(admin, 999999)).status).toBe(404);
		});
	});
});
