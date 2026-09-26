const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("../server");

let server;
let base;
const valid = { name: "Alex Candidate", email: "alex@example.com", password: "test-password-123", role: "seeker" };

before(async () => {
  server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

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

test("a new server starts empty: no database or persisted accounts", async () => {
  const fresh = createServer();
  await new Promise(resolve => fresh.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${fresh.address().port}`;
    assert.equal((await post({ email: valid.email, password: valid.password }, "/api/login", origin)).status, 401);
    assert.equal((await post(valid, "/api/register", origin)).status, 201);
  } finally { await new Promise(resolve => fresh.close(resolve)); }
});

test("serves the frontend but never exposes server source", async () => {
  assert.equal((await fetch(base + "/")).status, 200);
  assert.equal((await fetch(base + "/server.js")).status, 404);
});
