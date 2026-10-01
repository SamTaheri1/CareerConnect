const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createServer } = require("../server");

let server;
let base;
let dataDirectory;
let dataFile;
const valid = { name: "Alex Candidate", email: "alex@example.com", password: "test-password-123", role: "seeker" };

before(async () => {
  dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "careerconnect-test-"));
  dataFile = path.join(dataDirectory, "users.json");
  server = createServer({ dataFile });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(dataDirectory, { recursive: true, force: true });
});

async function post(data, endpoint = "/api/register", origin = base) {
  const response = await fetch(origin + endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  return { status: response.status, body: await response.json() };
}

test("1.7: registers a seeker and returns public account details", async () => {
  const result = await post(valid);
  assert.equal(result.status, 201);
  assert.equal(result.body.user.email, valid.email);
  assert.equal(result.body.user.name, valid.name);
  assert.equal(result.body.user.role, "seeker");
  assert.match(result.body.user.id, /^[a-f0-9-]{36}$/);
  assert.deepEqual(Object.keys(result.body.user).sort(), ["email", "id", "name", "role"]);
});

test("1.7: registers a recruiter and normalizes email and name", async () => {
  const result = await post({ ...valid, name: "  Taylor  ", email: " HIRE@EXAMPLE.COM ", role: "recruiter" });
  assert.equal(result.status, 201);
  assert.equal(result.body.user.name, "Taylor");
  assert.equal(result.body.user.email, "hire@example.com");
  assert.equal(result.body.user.role, "recruiter");
});

const invalidCases = [
  ["missing name", { name: undefined }],
  ["blank name", { name: "   " }],
  ["long name", { name: "a".repeat(81) }],
  ["non-string name", { name: 42 }],
  ["missing email", { email: undefined }],
  ["invalid email", { email: "not-an-email" }],
  ["long email", { email: "a".repeat(121) + "@example.com" }],
  ["non-string email", { email: [] }],
  ["missing password", { password: undefined }],
  ["short password", { password: "short" }],
  ["blank password", { password: "        " }],
  ["long password", { password: "a".repeat(129) }],
  ["non-string password", { password: 12345678 }],
  ["missing role", { role: undefined }],
  ["invalid role", { role: "admin" }],
];
for (const [label, fields] of invalidCases) {
  test(`1.8: rejects ${label}`, async () => {
    const result = await post({ ...valid, email: "invalid-case@example.com", ...fields });
    assert.equal(result.status, 400);
    assert.equal(typeof result.body.message, "string");
    assert.equal(result.body.user, undefined);
  });
}

test("1.8: rejects duplicate email regardless of case or whitespace", async () => {
  await post({ ...valid, email: "duplicate@example.com" });
  const result = await post({ ...valid, email: " DUPLICATE@EXAMPLE.COM " });
  assert.equal(result.status, 409);
});

test("invalid attempts do not reserve an email address", async () => {
  const result = await post({ ...valid, email: "invalid-case@example.com" });
  assert.equal(result.status, 201);
});

test("1.8: rejects malformed JSON and non-object bodies", async () => {
  const malformed = await fetch(base + "/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal(malformed.status, 400);
  for (const data of [null, [], "text"]) assert.equal((await post(data)).status, 400);
});

test("1.8: rejects wrong method, content type, and oversized body", async () => {
  assert.equal((await fetch(base + "/api/register")).status, 405);
  assert.equal((await fetch(base + "/api/register", { method: "POST", body: "text" })).status, 415);
  assert.equal((await post({ ...valid, name: "a".repeat(9000) })).status, 413);
});

test("newly registered account can log in; wrong credentials are rejected", async () => {
  await post({ ...valid, email: "login@example.com" });
  assert.equal((await post({ email: "login@example.com", password: valid.password }, "/api/login")).status, 200);
  assert.equal((await post({ email: "login@example.com", password: "incorrect-password" }, "/api/login")).status, 401);
});

test("accounts persist in the configured JSON file across server instances", async () => {
  await post({ ...valid, email: "persistent@example.com" });
  const fresh = createServer({ dataFile });
  await new Promise(resolve => fresh.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${fresh.address().port}`;
    assert.equal((await post({ email: "persistent@example.com", password: valid.password }, "/api/login", origin)).status, 200);
    assert.equal((await post({ ...valid, email: "persistent@example.com" }, "/api/register", origin)).status, 409);
  } finally { await new Promise(resolve => fresh.close(resolve)); }
});

test("stored accounts contain a salt and hash but never the plaintext password", async () => {
  await post({ ...valid, email: "stored@example.com", password: "stored-password-123" });
  const saved = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  const account = saved.users.find(item => item.user.email === "stored@example.com");
  assert.equal(typeof account.salt, "string");
  assert.equal(typeof account.passwordHash, "string");
  assert.equal(JSON.stringify(account).includes("stored-password-123"), false);
});

test("uses a configured API base path", async () => {
  const customFile = path.join(dataDirectory, "custom-api-users.json");
  const configured = createServer({ dataFile: customFile, config: { apiBasePath: "/service/auth" } });
  await new Promise(resolve => configured.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${configured.address().port}`;
    const clientConfig = await (await fetch(origin + "/config.js")).text();
    assert.match(clientConfig, /"apiBasePath":"\/service\/auth"/);
    assert.equal((await post(valid, "/service/auth/register", origin)).status, 201);
    assert.equal((await post(valid, "/api/register", origin)).status, 404);
  } finally {
    await new Promise(resolve => configured.close(resolve));
  }
});

test("limits repeated failed login attempts", async () => {
  const throttledFile = path.join(dataDirectory, "throttled-users.json");
  const throttled = createServer({ dataFile: throttledFile, config: { authMaxAttempts: 2, authWindowMs: 60000 } });
  await new Promise(resolve => throttled.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${throttled.address().port}`;
    await post({ ...valid, email: "limited@example.com" }, "/api/register", origin);
    const credentials = { email: "limited@example.com", password: "wrong-password" };
    assert.equal((await post(credentials, "/api/login", origin)).status, 401);
    assert.equal((await post(credentials, "/api/login", origin)).status, 401);
    assert.equal((await post(credentials, "/api/login", origin)).status, 429);
  } finally {
    await new Promise(resolve => throttled.close(resolve));
  }
});

test("resume feedback reports a clear setup error when OpenAI is not configured", async () => {
  const result = await post({ resumeText: "Alex Candidate\nSkills: JavaScript" }, "/api/resume-feedback");
  assert.equal(result.status, 503);
  assert.match(result.body.message, /not configured/i);
});

test("resume feedback sends validated text to OpenAI without exposing its key", async () => {
  const requests = [];
  const feedbackFile = path.join(dataDirectory, "feedback-users.json");
  const feedbackServer = createServer({
    dataFile: feedbackFile,
    config: { openAiApiKey: "test-key", openAiModel: "test-model" },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({ output_text: "Strengths\n- Clear skills\n\nImprovements\n- Add outcomes\n\nTailoring\n- Match keywords" }), { status: 200 });
    },
  });
  await new Promise(resolve => feedbackServer.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${feedbackServer.address().port}`;
    const result = await post({ resumeText: "Alex Candidate\nSkills: JavaScript", targetRole: "Junior developer" }, "/api/resume-feedback", origin);
    assert.equal(result.status, 200);
    assert.match(result.body.feedback, /Strengths/);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://api.openai.com/v1/responses");
    assert.equal(requests[0].options.headers.Authorization, "Bearer test-key");
    assert.match(requests[0].options.body, /test-model/);
    assert.doesNotMatch(JSON.stringify(result.body), /test-key/);
  } finally {
    await new Promise(resolve => feedbackServer.close(resolve));
  }
});

test("resume feedback validates its input before calling OpenAI", async () => {
  let calls = 0;
  const validationServer = createServer({
    dataFile: path.join(dataDirectory, "feedback-validation-users.json"),
    config: { openAiApiKey: "test-key" },
    fetch: async () => { calls += 1; throw new Error("should not run"); },
  });
  await new Promise(resolve => validationServer.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${validationServer.address().port}`;
    const result = await post({ resumeText: " " }, "/api/resume-feedback", origin);
    assert.equal(result.status, 400);
    assert.equal(calls, 0);
  } finally {
    await new Promise(resolve => validationServer.close(resolve));
  }
});

test("serves the frontend but never exposes server source", async () => {
  assert.equal((await fetch(base + "/")).status, 200);
  assert.equal((await fetch(base + "/server.js")).status, 404);
});
