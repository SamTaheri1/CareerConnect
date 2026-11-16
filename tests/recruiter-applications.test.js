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

test("only the owning recruiter can archive and restore a posting", async () => {
  const job = { id: "job-1", ownerId: "owner", status: "Open", deadline: "2099-01-01" };
  let recruiter = { id: "other", role: "recruiter" };
  const savedStatuses = [];
  const scope = vm.createContext({
    db: { jobs: [job] },
    user: () => recruiter,
    persist: async () => { savedStatuses.push(job.status); },
    render() {},
    toast() {},
  });
  const start = source.indexOf('} else if (action === "toggle-job"');
  assert.notEqual(start, -1);
  const postingAction = source.slice(start + 2, source.indexOf("\n  } catch", start));
  const visibility = source.slice(source.indexOf("function today()"), source.indexOf("function posted("));
  vm.runInContext(visibility + 'async function click(action, id) { if (false) {} ' + postingAction + '}', scope);

  await scope.click("archive-job", job.id);
  assert.equal(job.status, "Open");
  assert.deepEqual(savedStatuses, []);

  recruiter = { id: "owner", role: "recruiter" };
  await scope.click("archive-job", job.id);
  assert.equal(job.status, "Archived");
  assert.equal(scope.isOpen(job), false);

  await scope.click("archive-job", job.id);
  assert.equal(job.status, "Closed");
  assert.deepEqual(savedStatuses, ["Archived", "Closed"]);
});
