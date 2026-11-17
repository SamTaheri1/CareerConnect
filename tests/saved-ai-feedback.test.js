const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8").replace(/\r\n/g, "\n");

function between(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first);
  return source.slice(first, last);
}

function fixture(storage = new Map()) {
  let account = { id: "one", role: "seeker" };
  const elements = new Map();
  const messages = [];
  function element() {
    return { children: [], dataset: {}, innerHTML: "", textContent: "", isConnected: true,
      append(...items) { this.children.push(...items); },
      replaceChildren() { this.children = []; this.innerHTML = ""; },
      setAttribute(name, value) { this[name] = value; },
      addEventListener(event, listener) { this[event] = listener; },
    };
  }
  for (const id of ["#saved-resume-feedback", "#saved-application-advice"]) elements.set(id, element());
  const dot = {};
  const bell = { querySelector: () => dot, setAttribute() {} };
  elements.set("#notification-bell", bell);
  let modal = "";
  const scope = vm.createContext({
    user: () => account, uid: () => "feedback-id", icon: () => "", toast: text => messages.push(text),
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    document: { createElement: element, querySelector: key => elements.get(key), querySelectorAll: () => [], addEventListener() {} },
    modal: { classList: { add() {} } }, openModal: html => { modal = html; },
    requestData: async () => ({ advice: "## Next steps\n- **Prepare** examples." }),
  });
  vm.runInContext(
    between("function e(", "const uid") +
    between("function renderSavedResumeFeedback", "function renderSaved()") +
    between("function readSavedAdvice", "function renderApplications") +
    "const seenNotificationIds = new Map();\n" +
    between("function notificationHistoryKey", "async function refreshNotificationBell") +
    'async function click(action, id, button) {' +
    between('  if (action === "open-saved-feedback"', '\n  try {\n    if (action === "application-notes")') + "}", scope);
  return { scope, storage, elements, messages, dot, element, modal: () => modal, switchAccount: id => { account = { id, role: "seeker" }; } };
}

test("saved resume feedback survives reload, opens formatted content and can be unsaved", async () => {
  const f = fixture();
  const output = f.element();
  const result = { resumeName: "resume.pdf", targetRole: "Developer", feedback: "## Skills\n- **SQL**" };
  f.scope.showResumeFeedback(output, result, "one");
  output.children[0].click();
  assert.ok(f.messages.includes("Feedback saved."));
  const reloaded = fixture(f.storage);
  reloaded.scope.renderSavedResumeFeedback();
  assert.match(reloaded.elements.get("#saved-resume-feedback").innerHTML, /Developer/);
  await reloaded.scope.click("open-saved-feedback", "0");
  assert.match(reloaded.modal(), /<strong>SQL<\/strong>/);
  await reloaded.scope.click("unsave-feedback", "0");
  assert.match(reloaded.elements.get("#saved-resume-feedback").innerHTML, /No saved feedback yet/);
  assert.ok(reloaded.messages.includes("Feedback removed from saved."));
});

test("resume feedback replaces duplicate role entries and isolates accounts", () => {
  const f = fixture();
  for (const feedback of ["Old", "New"]) {
    const output = f.element();
    f.scope.showResumeFeedback(output, { resumeName: "resume.pdf", targetRole: "Developer", feedback }, "one");
    output.children[0].click();
  }
  assert.equal(JSON.parse(f.storage.get("careerconnect:resume-feedback:one")).length, 1);
  f.switchAccount("two");
  f.scope.renderSavedResumeFeedback();
  assert.doesNotMatch(f.elements.get("#saved-resume-feedback").innerHTML, /Developer/);
});

test("generated advice saves, reopens and unsaves with confirmation", async () => {
  const f = fixture(), output = f.element();
  const card = { querySelector: selector => selector === "h3" ? { textContent: "Developer" } : output };
  await f.scope.click("application-advice", "app", { closest: () => card });
  const save = output.children[0];
  save.click();
  assert.match(f.elements.get("#saved-application-advice").innerHTML, /Developer/);
  await f.scope.click("open-saved-advice", "app");
  assert.match(f.modal(), /<strong>Prepare<\/strong>/);
  save.click();
  assert.match(f.elements.get("#saved-application-advice").innerHTML, /No saved advice yet/);
  assert.ok(f.messages.includes("Advice removed from saved."));
  save.click();
  await f.scope.click("unsave-advice", "app");
  assert.equal(JSON.parse(f.storage.get("careerconnect:application-advice:one")).length, 0);
});

test("bell remembers seen alerts across reload and login and flags only new unread alerts", () => {
  const f = fixture(), alerts = [{ id: "old", readAt: null }];
  f.scope.updateNotificationBell(alerts);
  assert.equal(f.dot.hidden, false);
  f.scope.acknowledgeNotificationBell("one", alerts);
  const reloaded = fixture(f.storage);
  reloaded.scope.updateNotificationBell(alerts);
  assert.equal(reloaded.dot.hidden, true);
  reloaded.scope.updateNotificationBell([...alerts, { id: "new", readAt: null }]);
  assert.equal(reloaded.dot.hidden, false);
  reloaded.scope.updateNotificationBell([...alerts, { id: "read", readAt: "today" }]);
  assert.equal(reloaded.dot.hidden, true);
  reloaded.switchAccount("two");
  reloaded.scope.updateNotificationBell(alerts);
  assert.equal(reloaded.dot.hidden, false);
});

