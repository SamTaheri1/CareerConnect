const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const storageCode = source.slice(source.indexOf("let db ="), source.indexOf("function toast"));
const fileCode = source.slice(source.indexOf("async function fileOperation"), source.indexOf("async function previewResume"));

test("frontend saves only changed records and restores server state after a failed save", async () => {
  const requests = [];
  let rejectSave = false;
  const state = { sessionId: "user-1", users: [{ id: "user-1", name: "Alex" }],
    jobs: [{ id: "job-1", title: "Developer" }], applications: [] };
  const context = vm.createContext({
    structuredClone, window: { CareerConnectConfig: { apiBasePath: "/service" } },
    fetch: async (url, options) => {
      requests.push({ url, body: options.body && JSON.parse(options.body) });
      if (rejectSave) return { ok: false, json: async () => ({ message: "Save failed" }) };
      if (options.body) state.users[0] = JSON.parse(options.body).person;
      return { ok: true, json: async () => structuredClone(state) };
    },
  });
  vm.runInContext(storageCode, context);
  await context.refreshData();
  vm.runInContext('user().name = "Updated"', context);
  await context.persist();
  assert.equal(requests[1].url, "/service/state");
  assert.deepEqual(requests[1].body.jobs, []);
  assert.equal(requests[1].body.person.name, "Updated");
  rejectSave = true;
  vm.runInContext('user().name = "Unsaved"', context);
  await assert.rejects(context.persist(), /Save failed/);
  assert.equal(context.user().name, "Updated");
});

test("frontend sends resume bytes and preserves the name of an application copy", async () => {
  let saved;
  const context = vm.createContext({
    Uint8Array, btoa, Blob,
    requestData: async (endpoint, body) => { saved = { endpoint, body }; },
    user: () => ({ resumes: [] }),
  });
  vm.runInContext(fileCode, context);
  await context.fileOperation("put", "application-copy", new Blob(["%PDF-1.4 resume"]), "original.pdf");
  assert.equal(saved.endpoint, "/files");
  assert.equal(saved.body.name, "original.pdf");
  assert.equal(Buffer.from(saved.body.content, "base64").toString(), "%PDF-1.4 resume");
});
