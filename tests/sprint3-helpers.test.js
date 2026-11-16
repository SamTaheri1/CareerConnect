const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const helperSource = source.slice(0, source.indexOf("const main"));
const context = {};
vm.createContext(context);
vm.runInContext(
  `${helperSource}; globalThis.toggleSavedJob = toggleSavedJob; globalThis.recruiterOwnsApplication = recruiterOwnsApplication;`,
  context,
);

test("Sprint 3 saved jobs can be added and removed without changing the original list", () => {
  const original = ["job-1"];
  const added = JSON.parse(JSON.stringify(context.toggleSavedJob(original, "job-2")));
  const removed = JSON.parse(JSON.stringify(context.toggleSavedJob(added, "job-1")));

  assert.deepEqual(original, ["job-1"]);
  assert.deepEqual(added, ["job-1", "job-2"]);
  assert.deepEqual(removed, ["job-2"]);
});

test("only the recruiter who owns the posting can review its application", () => {
  const application = { id: "application-1", jobId: "job-1" };
  const jobs = [
    { id: "job-1", ownerId: "recruiter-1" },
    { id: "job-2", ownerId: "recruiter-2" },
  ];

  assert.equal(context.recruiterOwnsApplication(application, jobs, "recruiter-1"), true);
  assert.equal(context.recruiterOwnsApplication(application, jobs, "recruiter-2"), false);
  assert.equal(context.recruiterOwnsApplication(null, jobs, "recruiter-1"), false);
});
