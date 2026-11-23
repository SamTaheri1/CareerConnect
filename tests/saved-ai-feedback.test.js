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

function fixture(storage = new Map(), request = async () => ({ advice: "## Next steps\n- **Prepare** examples." })) {
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
    document: { createElement: element, querySelector: key => elements.get(key), querySelectorAll: () => elements.get("adviceButtons") || [], addEventListener() {} },
    modal: { classList: { add() {} } }, openModal: html => { modal = html; },
    requestData: request,
  });
  vm.runInContext(
    between("function e(", "const uid") +
    between("const aiRequests = new Map()", "function renderSavedResumeFeedback") +
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
  const adviceButton = { dataset: { id: "app" }, closest: () => card };
  f.elements.set("adviceButtons", [adviceButton]);
  await f.scope.click("application-advice", "app", adviceButton);
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


for (const kind of ["resume", "advice"]) {
  test(kind + " generation keeps progress and result across internal navigation", async () => {
    let resolveRequest, calls = 0;
    const f = fixture(new Map(), () => {
      calls += 1;
      return new Promise(resolve => { resolveRequest = resolve; });
    });
    function mount() {
      const output = f.element();
      if (kind === "resume") {
        const button = {};
        f.elements.set("#resume-feedback-result", output);
        f.elements.set("#resume-feedback-form", {
          elements: { resumeId: {}, targetRole: {} }, querySelector: () => button,
        });
        return { output, button };
      }
      const button = { dataset: { id: "app" }, closest: () => ({ querySelector: () => output }) };
      f.elements.set("adviceButtons", [button]);
      return { output, button };
    }
    function leave() {
      f.elements.delete("#resume-feedback-form");
      f.elements.delete("#resume-feedback-result");
      f.elements.set("adviceButtons", []);
    }
    const input = kind === "resume" ? { resumeId: "resume", targetRole: "Developer" } : { applicationId: "app" };
    const id = kind === "resume" ? "current" : "app";
    mount();
    const pending = f.scope.generateAiResult(kind, id, input, "Developer");
    f.scope.generateAiResult(kind, id, input, "Developer");
    assert.equal(calls, 1);
    leave();
    const during = mount();
    f.scope.restoreAiProgress();
    assert.equal(during.button.disabled, true);
    assert.match(during.output.textContent, /switch pages/);
    leave();
    resolveRequest({ feedback: "## Skills\n- **SQL**", advice: "## Prepare\n- **SQL**", resumeName: "resume.pdf", targetRole: "Developer" });
    await pending;
    const after = mount();
    f.scope.restoreAiProgress();
    assert.equal(after.button.disabled, false);
    assert.match(after.output.innerHTML, /<strong>SQL<\/strong>/);
    assert.ok(after.output.children.some(button => /Save/.test(button.textContent)));
    f.switchAccount("two");
    const other = mount();
    f.scope.restoreAiProgress();
    assert.equal(other.output.innerHTML, "");
    f.switchAccount("one");
    f.scope.restoreAiProgress();
    assert.match(other.output.innerHTML, /<strong>SQL<\/strong>/);
  });

  test(kind + " failure survives navigation and allows a new request", async () => {
    let rejectRequest, calls = 0;
    const f = fixture(new Map(), () => {
      calls += 1;
      return new Promise((resolve, reject) => { rejectRequest = reject; });
    });
    const id = kind === "resume" ? "current" : "app";
    const pending = f.scope.generateAiResult(kind, id, { resumeId: "resume", targetRole: "Developer" }, "Developer");
    rejectRequest(new Error("provider error"));
    await pending;
    const output = f.element(), button = { dataset: { id: "app" }, closest: () => ({ querySelector: () => output }) };
    if (kind === "resume") {
      f.elements.set("#resume-feedback-result", output);
      f.elements.set("#resume-feedback-form", { elements: { resumeId: {}, targetRole: {} }, querySelector: () => button });
    } else f.elements.set("adviceButtons", [button]);
    f.scope.restoreAiProgress();
    assert.match(output.textContent, /Could not get/);
    assert.equal(button.disabled, false);
    const retry = f.scope.generateAiResult(kind, id, { resumeId: "resume", targetRole: "Developer" }, "Developer");
    assert.equal(calls, 2);
    rejectRequest(new Error("provider error"));
    await retry;
  });
}

test("resume feedback and next-step advice generate independently at the same time", async () => {
  const resolvers = [];
  const f = fixture(new Map(), () => new Promise(resolve => resolvers.push(resolve)));
  const resume = f.scope.generateAiResult("resume", "current", { resumeId: "r", targetRole: "" });
  const advice = f.scope.generateAiResult("advice", "a", { applicationId: "a" });
  assert.equal(resolvers.length, 2);
  resolvers[0]({ feedback: "Resume ready" });
  resolvers[1]({ advice: "Advice ready" });
  await Promise.all([resume, advice]);
  assert.equal(f.messages.length, 2);
});
