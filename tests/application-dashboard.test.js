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

test("weekly activity counts only the seeker's submissions at the Monday boundary", () => {
  const applications = [
    { userId: "seeker-1", createdAt: new Date(2026, 10, 8, 23, 59) },
    { userId: "seeker-1", createdAt: new Date(2026, 10, 9) },
    { userId: "seeker-2", createdAt: new Date(2026, 10, 9) },
    { userId: "seeker-1", createdAt: new Date(2026, 10, 12) },
  ];
  const own = context.applicationSummary(applications, "seeker-1").applications;
  const weeks = context.weeklyApplicationCounts(own, new Date(2026, 10, 11));
  assert.deepEqual(Array.from(weeks, week => week.count), [0, 0, 1, 1]);
});

function dashboardFixture() {
  const person = { id: "seeker-1", role: "seeker", saved: [] };
  const application = {
    id: "offered", userId: person.id, jobId: "job-1", status: "Offered",
    name: "Alex Example", email: "alex@example.test", resumeName: "original.pdf",
    note: "<script>original note</script>", createdAt: "2026-11-12T14:00:00Z",
    history: [{ status: "Applied", date: "2026-11-12" }, { status: "Offered", date: "2026-11-13" }],
  };
  const jobs = [
    { id: "job-1", title: "Design intern", company: "Studio" },
    { id: "job-2", title: "QA tester", company: "Labs" },
    { id: "job-3", title: "Private posting", company: "Other" },
  ];
  const applications = [
    application,
    { ...application, id: "rejected", jobId: "job-2", status: "Rejected" },
    { ...application, id: "private", jobId: "job-3", userId: "seeker-2" },
  ];
  const views = { page: "", modal: "" };
  const listeners = {};
  const modalClasses = new Set();
  let closed = 0;
  const modal = {
    classList: { add: value => modalClasses.add(value), contains: value => modalClasses.has(value) },
    addEventListener: (event, listener) => { listeners[event] = listener; },
    getBoundingClientRect: () => ({ left: 10, top: 10, right: 100, bottom: 100 }),
    close: () => { closed += 1; },
  };
  const scope = vm.createContext({
    seenNotifications: () => new Set(),
    db: { applications, jobs }, user: () => person, applicationFilter: "All",
    shell: html => { views.page = html; },
    openModal: html => { views.modal = html; }, modal,
    date: String, badge: String, empty: title => title,
    icon: () => "", logo: () => "", deadlineList: () => "",
    renderSavedApplicationAdvice() {},
    document: { querySelector: () => null },
  });
  function readBetween(start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from);
    return source.slice(from, to);
  }
  vm.runInContext(dashboardSource
    + readBetween("function e(", "const uid")
    + readBetween("function applicationStatusSections(", "async function renderNotifications")
    + readBetween("function renderApplications(", "async function openApplicationNotes")
    + readBetween('modal.addEventListener("click"', 'modal.addEventListener("close"')
    + 'function clickStatus(id) { const action = "filter-application-status";'
    + readBetween('  if (action === "filter-application-status")', '  if (action === "open-saved-advice")')
    + '}', scope);
  return { scope, views, listeners, modal, closed: () => closed };
}

test("status cards filter only history and Total applications resets it", () => {
  const { scope, views } = dashboardFixture();
  scope.clickStatus("Offered");
  assert.match(views.page, /data-id="Offered" aria-pressed="true"/);
  assert.match(views.page, /Design intern/);
  assert.doesNotMatch(views.page, /QA tester|Private posting/);
  assert.match(views.page, /Total applications/);
  assert.match(views.page, /Applications submitted per week/);
  scope.clickStatus("All");
  assert.match(views.page, /data-id="All" aria-pressed="true"/);
  assert.match(views.page, /QA tester/);
  assert.doesNotMatch(views.page, /Private posting/);
});

test("expandable sections group only the seeker's applications and link to the submission", () => {
  const { scope } = dashboardFixture();
  const html = scope.applicationStatusSections();
  assert.match(html, /<details[^>]*>\s*<summary><strong>Offered \(1\)<\/strong>[\s\S]*?Design intern[\s\S]*?data-action="view-submitted-application" data-id="offered"/);
  assert.match(html, /Rejected \(1\)[\s\S]*?QA tester/);
  assert.match(html, /Interview \(0\)/);
  assert.doesNotMatch(html, /Private posting/);
});

test("submission popup shows original details only for its owner and dismisses on the backdrop", () => {
  const { scope, views, listeners, modal, closed } = dashboardFixture();
  scope.showSubmittedApplication("private");
  assert.equal(views.modal, "");
  scope.showSubmittedApplication("offered");
  for (const text of ["Design intern", "Alex Example", "alex@example.test", "original.pdf", "Status history", "Offered", "Applied", "&lt;script&gt;original note&lt;/script&gt;"]) {
    assert.ok(views.modal.includes(text), text);
  }
  assert.match(views.modal, /data-action="download-submitted-application" data-id="offered"/);
  listeners.click({ target: modal, clientX: 50, clientY: 50 });
  assert.equal(closed(), 0);
  listeners.click({ target: modal, clientX: 5, clientY: 50 });
  assert.equal(closed(), 1);
});


test("submenu dots flag only unseen updates for applications in that group", () => {
  const { scope } = dashboardFixture();
  const items = [
    { id: "new-offer", applicationId: "offered" },
    { id: "already-read", applicationId: "rejected", readAt: "2026-01-01" },
    { id: "other-user", applicationId: "private" },
  ];
  const html = scope.applicationStatusSections(items);
  assert.equal((html.match(/class="application-update-dot"/g) || []).length, 1);
  assert.match(html, /Offered \(1\)<\/strong><span class="application-update-dot"/);
  scope.seenNotifications = () => new Set(["new-offer"]);
  assert.doesNotMatch(scope.applicationStatusSections(items), /class="application-update-dot"/);
});

test("opening a submenu removes its dot and remembers only that submenu's updates", () => {
  const storage = new Map();
  const code = source.slice(source.indexOf("const seenNotificationIds"), source.indexOf('document.addEventListener("click", event =>'));
  function loadPage() {
    let onToggle;
    const scope = vm.createContext({
      user: () => ({ id: "seeker-1" }),
      document: { addEventListener(type, handler, capture) {
        assert.equal(type, "toggle");
        assert.equal(capture, true); // details toggle events do not bubble.
        onToggle = handler;
      } },
      localStorage: {
        getItem: key => storage.get(key) || null,
        setItem: (key, value) => storage.set(key, value),
      },
    });
    vm.runInContext(code, scope);
    return { scope, toggle: section => onToggle({ target: section }) };
  }
  const page = loadPage();
  let removed = false;
  const section = {
    open: false,
    matches: selector => selector === "details[data-application-updates]",
    dataset: { accountId: "seeker-1", applicationUpdates: '["offer-update"]' },
    querySelector: () => ({ remove() { removed = true; } }),
  };
  page.toggle(section);
  assert.equal(removed, false);
  section.open = true;
  page.toggle(section);
  assert.equal(removed, true);
  const seen = page.scope.seenNotifications("seeker-1:application-submenus");
  assert.equal(seen.has("offer-update"), true);
  assert.equal(seen.has("interview-update"), false);
  assert.equal(loadPage().scope.seenNotifications("seeker-1:application-submenus").has("offer-update"), true);
  assert.equal(loadPage().scope.seenNotifications("seeker-2:application-submenus").has("offer-update"), false);
});
