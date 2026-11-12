const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const dashboardSource = source.slice(0, source.indexOf("const main"));
const context = {};
vm.createContext(context);
vm.runInContext(
  `${dashboardSource}; globalThis.applicationSummary = applicationSummary; globalThis.statuses = statuses;`,
  context,
);

const summarize = (applications, userId) =>
  JSON.parse(JSON.stringify(context.applicationSummary(applications, userId)));

test("application dashboard counts only the logged-in seeker's applications", () => {
  const applications = [
    { id: "a", userId: "seeker-1", status: "Applied" },
    { id: "b", userId: "seeker-1", status: "Under Review" },
    { id: "c", userId: "seeker-1", status: "Rejected" },
    { id: "private", userId: "seeker-2", status: "Offered" },
  ];

  const summary = summarize(applications, "seeker-1");
  assert.equal(summary.total, 3);
  assert.deepEqual(summary.applications.map((item) => item.id), ["a", "b", "c"]);
  assert.deepEqual(summary.counts, {
    Applied: 1,
    "Under Review": 1,
    Interview: 0,
    Offered: 0,
    Rejected: 1,
  });
});

test("application dashboard displays zero counts when the seeker has no applications", () => {
  const summary = summarize([], "seeker-1");
  assert.equal(summary.total, 0);
  assert.ok(Object.values(summary.counts).every((count) => count === 0));
});

test("application dashboard recalculates after an application status changes", () => {
  const applications = [{ id: "a", userId: "seeker-1", status: "Applied" }];
  const before = summarize(applications, "seeker-1");
  applications[0].status = "Interview";
  const after = summarize(applications, "seeker-1");

  assert.equal(before.counts.Applied, 1);
  assert.equal(after.counts.Applied, 0);
  assert.equal(after.counts.Interview, 1);
  assert.equal(after.total, 1);
});
