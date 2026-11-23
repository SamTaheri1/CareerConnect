const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createTestDatabase } = require("./postgres-helper");

test("notifications track new applications, status changes and deadlines with owner-only read access", async () => {
  const db = await createTestDatabase();
  const recruiter = { id: "recruiter", role: "recruiter", name: "Recruiter", email: "recruiter@example.test" };
  const seeker = { id: "seeker", role: "seeker", name: "Seeker", email: "seeker@example.test" };
  const other = { id: "other", role: "seeker", name: "Other", email: "other@example.test" };
  try {
    for (const user of [recruiter, seeker, other]) await db.add({ user, salt: "salt", passwordHash: "hash" });
    const deadline = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const job = { ...(await db.state(seeker)).jobs[0], id: "owned-job", ownerId: recruiter.id, deadline };
    await db.saveJob(job);
    await db.file(seeker, "put", "resume", { name: "test.pdf", content: Buffer.from("%PDF-1.4 test").toString("base64") });
    const application = { id: "application", jobId: job.id, userId: seeker.id, resumeId: "resume", name: seeker.name, email: seeker.email, note: "" };
    await db.save(seeker, { applications: [application] });
    const before = await db.sql.prepare("SELECT * FROM applications WHERE id = ?").get(application.id);
    const { createApplicationAdviceHandler } = require("../ai/application-advice");
    const handler = createApplicationAdviceHandler({
      config: { openAiApiKey: "test-key", aiRequestTimeoutMs: 1000 },
      store: { session: async () => seeker, applicationForAdvice: (...args) => db.applicationForAdvice(...args) },
      limiter: { check() {} },
      fetch: async () => new Response("{}", { status: 503 }),
    });
    await assert.rejects(handler({ applicationId: application.id }, {}), error => error.status === 503);
    assert.deepEqual(await db.sql.prepare("SELECT * FROM applications WHERE id = ?").get(application.id), before);

    const recruiterAlerts = await db.notifications(recruiter);
    assert.equal(recruiterAlerts.filter(item => item.kind === "new_application").length, 1);
    await assert.rejects(db.markNotificationRead(other, recruiterAlerts[0].id), error => error.status === 404);
    await db.markNotificationRead(recruiter, recruiterAlerts[0].id);
    assert.ok((await db.notifications(recruiter))[0].readAt);
    await db.save(recruiter, { applications: [{ ...application, status: "Interview" }] });
    assert.ok((await db.notifications(seeker)).some(item => item.kind === "interview_status"));
    await db.save(recruiter, { applications: [{ ...application, status: "Interview", recruiterMessage: "  Please bring your portfolio.  " }] });
    let submitted = (await db.state(seeker)).applications.find(item => item.id === application.id);
    assert.equal(submitted.history.at(-1).message, "Please bring your portfolio.");
    assert.equal(submitted.history.at(-1).recruiterName, recruiter.name);
    assert.equal(submitted.status, "Interview");
    await assert.rejects(db.save(other, { applications: [{ ...application, status: "Offered", recruiterMessage: "Unauthorized" }] }), error => error.status === 403);
    await assert.rejects(db.save(recruiter, { applications: [{ ...application, status: "Offered", recruiterMessage: "x".repeat(2001) }] }), error => error.status === 400);
    submitted = (await db.state(seeker)).applications.find(item => item.id === application.id);
    assert.equal(submitted.status, "Interview");
    assert.equal(submitted.history.at(-1).message, "Please bring your portfolio.");

    assert.equal((await db.notifications(other)).length, 0);
    const profile = (await db.state(seeker)).users[0];
    await db.save(seeker, { person: { ...profile, saved: [job.id] } });
    await db.notifications(seeker);
    await db.notifications(seeker);
    const alerts = await db.notifications(seeker);
    assert.equal(alerts.filter(item => item.kind === "deadline").length, 1);
    assert.deepEqual(await db.applicationForAdvice(seeker, application.id), { title: job.title, description: job.description, status: "Interview" });
    await assert.rejects(db.applicationForAdvice(other, application.id), error => error.status === 404);
    assert.equal(before.status, "Applied");
  } finally { await db.close(); }
});


test("a seeker can apply to the Orbit sample job without a recruiter owner", async () => {
  const db = await createTestDatabase();
  const seeker = { id: "orbit-seeker", role: "seeker", name: "Test Seeker", email: "orbit@example.test" };
  try {
    await db.add({ user: seeker, salt: "salt", passwordHash: "hash" });
    const job = (await db.state(seeker)).jobs.find(item => item.company === "Orbit");
    assert.ok(job);
    assert.equal(job.ownerId, null);
    await db.file(seeker, "put", "orbit-resume", {
      name: "resume.pdf", content: Buffer.from("%PDF-1.4 test").toString("base64"),
    });
    const application = { id: "orbit-application", jobId: job.id, userId: seeker.id,
      resumeId: "orbit-resume", name: seeker.name, email: seeker.email, note: "" };
    await db.save(seeker, { applications: [application] });
    assert.ok((await db.state(seeker)).applications.some(item => item.id === application.id));
    assert.equal((await db.sql.prepare("SELECT COUNT(*) AS count FROM notifications WHERE application_id = ?").get(application.id)).count, 0);
  } finally { await db.close(); }
});
