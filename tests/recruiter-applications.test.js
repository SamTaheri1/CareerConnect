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
  `${helperSource}; globalThis.filterRecruiterApplications = filterRecruiterApplications;`,
  context,
);

const applications = [
  { id: "new", jobId: "owned-1", status: "Applied", createdAt: "2026-11-12T14:00:00.000Z" },
  { id: "review", jobId: "owned-1", status: "Under Review", createdAt: "2026-11-11T14:00:00.000Z" },
  { id: "interview", jobId: "owned-2", status: "Interview", createdAt: "2026-11-12T12:00:00.000Z" },
  { id: "private", jobId: "another-recruiter-job", status: "Applied", createdAt: "2026-11-12T16:00:00.000Z" },
];

const filter = (filters = {}) =>
  JSON.parse(JSON.stringify(context.filterRecruiterApplications(
    applications,
    ["owned-1", "owned-2"],
    filters,
  )));

test("recruiter application list includes only applications for owned postings", () => {
  assert.deepEqual(filter().map((item) => item.id), ["new", "interview", "review"]);
});

test("recruiter application list filters by posting, status and application date", () => {
  assert.deepEqual(filter({ jobId: "owned-1" }).map((item) => item.id), ["new", "review"]);
  assert.deepEqual(filter({ status: "Under Review" }).map((item) => item.id), ["review"]);
  assert.deepEqual(filter({ date: "2026-11-12" }).map((item) => item.id), ["new", "interview"]);
  assert.deepEqual(
    filter({ jobId: "owned-1", status: "Applied", date: "2026-11-12" }).map((item) => item.id),
    ["new"],
  );
});

test("cleared recruiter filters show all owned applications again", () => {
  assert.equal(filter({ jobId: "", status: "All", date: "" }).length, 3);
});
