const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createServer } = require("../server");
const { Database } = require("../database");
const { hashPassword } = require("../auth/password");
const { loadConfig } = require("../config");

test("SQLite saves profiles, jobs, resumes and applications across a full restart", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "careerconnect-sqlite-"));
  const databaseFile = path.join(directory, "nested", "site.sqlite");
  let server;
  let origin;
  async function start() {
    server = createServer({ databaseFile });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  }
  async function request(endpoint, body, cookie) {
    const response = await fetch(origin + "/api/" + endpoint, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, cookie: response.headers.get("set-cookie")?.split(";")[0],
      body: endpoint.startsWith("files?") && response.ok ? await response.text() : await response.json() };
  }
  async function register(email, role) {
    const result = await request("register", { name: role, email, role, password: "password-123" });
    assert.equal(result.status, 201);
    return { ...result.body.user, cookie: result.cookie };
  }
  try {
    await start();
    const seeker = await register("seeker@example.com", "seeker");
    const recruiter = await register("recruiter@example.com", "recruiter");
    const other = await register("other@example.com", "recruiter");
    assert.equal((await request("state", {})).status, 401);
    let state = (await request("state", undefined, seeker.cookie)).body;
    const person = state.users[0];
    person.name = "Alex Candidate";
    person.profile = { headline: "Developer", skills: "JavaScript", website: "https://example.com" };
    person.saved = [state.jobs[0].id];
    person.preparationChecklists = { [state.jobs[0].id]: ["resume", "requirements"] };
    assert.equal((await request("state", { person }, seeker.cookie)).status, 200);
    const job = { ...state.jobs[0], id: "new-job", ownerId: recruiter.id, title: "Database Developer" };
    assert.equal((await request("state", { jobs: [job] }, recruiter.cookie)).status, 200);
    assert.equal((await request("state", { jobs: [{ ...job, title: "Stolen" }] }, other.cookie)).status, 403);
    assert.equal((await request("state", { jobs: [{ ...job, ownerId: seeker.id }] }, seeker.cookie)).status, 403);
    const content = Buffer.from("%PDF-1.4 original resume").toString("base64");
    const upload = (id, bytes = content) => ({ action: "put", id, name: "resume.pdf", content: bytes });
    assert.equal((await request("files", upload("resume-1"), seeker.cookie)).status, 200);
    person.resumes = [{ id: "resume-1", name: "resume.pdf" }];
    assert.equal((await request("state", { person }, seeker.cookie)).status, 200);
    assert.equal((await request("files", upload("application-copy"), seeker.cookie)).status, 200);
    const application = { id: "application-1", userId: seeker.id, jobId: job.id, resumeId: "application-copy", name: person.name, email: seeker.email, note: "Hello" };
    assert.equal((await request("state", { applications: [application] }, seeker.cookie)).status, 200);
    assert.equal((await request("state", { applications: [{ ...application, id: "duplicate" }] }, seeker.cookie)).status, 409);
    assert.equal((await request("files", upload("application-copy"), seeker.cookie)).status, 409);
    assert.equal((await request("files", { action: "delete", id: "application-copy" }, seeker.cookie)).status, 409);
    assert.equal((await request("files?id=application-copy", undefined, recruiter.cookie)).body, "%PDF-1.4 original resume");
    assert.equal((await request("files?id=application-copy", undefined, other.cookie)).status, 404);
    assert.equal((await request("files?id=resume-1", undefined, recruiter.cookie)).status, 404);
    assert.equal((await request("files", upload("resume-1", Buffer.from("%PDF-1.4 replaced").toString("base64")), seeker.cookie)).status, 200);
    assert.equal((await request("files?id=application-copy", undefined, recruiter.cookie)).body, "%PDF-1.4 original resume");
    assert.equal((await request("state", { applications: [{ ...application, status: "Offered" }] }, other.cookie)).status, 403);
    assert.equal((await request("state", { applications: [{ ...application, status: "Interview" }] }, recruiter.cookie)).status, 200);
    // A transaction with an invalid job must also roll back its profile changes.
    assert.equal((await request("state", { person: { ...person, name: "Not saved" }, jobs: [job] }, seeker.cookie)).status, 403);
    assert.equal((await request("state", undefined, seeker.cookie)).body.users[0].name, "Alex Candidate");
    person.resumes = [];
    assert.equal((await request("state", { person }, seeker.cookie)).status, 200);
    assert.equal((await request("files", { action: "delete", id: "resume-1" }, seeker.cookie)).status, 200);

    await new Promise(resolve => server.close(resolve));
    server = null;
    await start();
    assert.equal((await request("login", { email: seeker.email, password: "password-123" })).status, 200);
    state = (await request("state", undefined, seeker.cookie)).body;
    assert.equal(state.users[0].profile.headline, "Developer");
    assert.deepEqual(state.users[0].saved, person.saved);
    assert.deepEqual(state.users[0].preparationChecklists, person.preparationChecklists);
    assert.equal(state.users[0].resumes.length, 0);
    assert.equal(state.jobs.find(item => item.id === job.id).title, "Database Developer");
    assert.equal(state.applications[0].status, "Interview");
    assert.equal(state.applications[0].history.length, 2);
    assert.equal((await request("files?id=application-copy", undefined, recruiter.cookie)).body, "%PDF-1.4 original resume");
    assert.equal((await request("state", undefined, other.cookie)).body.applications.length, 0);
    assert.equal((await request("state")).body.users.length, 0);
    assert.equal((await fetch(origin + "/data/careerconnect.sqlite")).status, 404);
    assert.equal((await request("logout", {}, seeker.cookie)).status, 200);
    assert.equal((await request("state", undefined, seeker.cookie)).body.sessionId, null);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("existing JSON accounts are imported once without changing their password hashes", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "careerconnect-import-"));
  const filename = path.join(directory, "site.sqlite");
  const legacy = path.join(directory, "users.json");
  const account = { user: { id: "legacy-user", name: "Legacy", email: "legacy@example.com", role: "seeker" }, salt: "legacy-salt" };
  account.passwordHash = await hashPassword("original-password", account.salt, loadConfig());
  fs.writeFileSync(legacy, JSON.stringify({ users: [account] }));
  let database;
  try {
    database = new Database(filename, legacy);
    assert.deepEqual(database.findByEmail(account.user.email), account);
    database.close();
    database = new Database(filename, legacy);
    assert.equal(database.sql.prepare("SELECT count(*) AS count FROM users").get().count, 1);
    assert.equal(database.state(account.user).users[0].profile.bio, "");
    assert.equal(JSON.parse(fs.readFileSync(legacy, "utf8")).users.length, 1);
    assert.throws(() => database.sql.prepare("INSERT INTO saved_jobs VALUES ('missing', 'job-1')").run(), /FOREIGN KEY/);
  } finally {
    database?.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
