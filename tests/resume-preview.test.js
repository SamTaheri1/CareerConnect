const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(require("node:path").join(__dirname, "../app.js"), "utf8");
function setup({ name = "resume.pdf", file = new Blob(["%PDF-1.4"]), supported = true, read } = {}) {
  let body;
  let frame;
  let markup;
  let created = 0;
  const revoked = [];
  const listeners = {};
  const classes = new Set();
  const person = { id: "seeker", role: "seeker", resumes: [{ id: "resume", name }] };
  const modal = {
    open: false,
    classList: { add: (v) => classes.add(v), remove: (v) => classes.delete(v) },
    querySelector: () => frame,
    addEventListener: (type, fn) => { listeners[type] = fn; },
    showModal() { this.open = true; },
  };
  const content = {
    set innerHTML(value) {
      markup = value;
      if (body) body.isConnected = false;
      body = { isConnected: true, setAttribute() {}, replaceChildren(...children) { this.children = children; frame = children[0]; } };
    },
  };
  const context = vm.createContext({
    modal, Blob, navigator: { pdfViewerEnabled: supported },
    user: () => person,
    e: (v) => String(v).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]),
    fileOperation: read || (async () => file),
    URL: { createObjectURL(blob) { assert.equal(blob.type, "application/pdf"); return `blob:test-${++created}`; }, revokeObjectURL: (url) => revoked.push(url) },
    document: {
      querySelector: (selector) => selector === "#modal-content" ? content : body,
      createElement: (tag) => ({ tag, remove() { frame = null; } }),
    },
  });
  vm.runInContext(source.slice(source.indexOf("let resumePreviewUrl"), source.indexOf("function applyModal")), context);
  vm.runInContext(source.slice(source.indexOf("async function previewResume"), source.indexOf("async function downloadFile")), context);
  return { context, modal, person, revoked, classes, get body() { return body; }, get markup() { return markup; }, get created() { return created; }, close() { modal.open = false; listeners.close(); } };
}

test("PDF preview stays in a titled iframe and releases its URL on close", async () => {
  const env = setup({ name: '<resume>.PDF' });
  await env.context.previewResume("resume");
  assert.equal(env.modal.open, true);
  assert.match(env.markup, /&lt;resume&gt;.PDF/);
  assert.equal(env.body.children[0].tag, "iframe");
  assert.equal(env.body.children[0].title, "Resume preview: <resume>.PDF");
  assert.equal(env.body.children[0].src, "blob:test-1");
  env.close();
  assert.deepEqual(env.revoked, ["blob:test-1"]);
  assert.equal(env.classes.has("resume-preview-modal"), false);
});

test("Word files and unsupported browsers get an in-page explanation", async () => {
  for (const options of [{ name: "resume.doc" }, { name: "resume.docx" }, { supported: false }]) {
    const env = setup(options);
    await env.context.previewResume("resume");
    assert.match(env.body.textContent, /download/i);
    assert.equal(env.created, 0);
  }
});

test("missing files and storage errors are shown inside the dialog", async () => {
  for (const options of [{ file: null }, { read: async () => { throw new Error("Storage unavailable"); } }]) {
    const env = setup(options);
    await env.context.previewResume("resume");
    assert.match(env.body.textContent, /no longer available|Storage unavailable/);
    assert.equal(env.created, 0);
  }
});

test("closing during a pending read does not recreate the preview", async () => {
  let resolve;
  const env = setup({ read: () => new Promise((done) => { resolve = done; }) });
  const pending = env.context.previewResume("resume");
  env.close();
  resolve(new Blob(["%PDF-"]));
  await pending;
  assert.equal(env.created, 0);
});

test("replacing a preview revokes the previous URL", async () => {
  const env = setup();
  await env.context.previewResume("resume");
  await env.context.previewResume("resume");
  assert.deepEqual(env.revoked, ["blob:test-1"]);
  assert.equal(env.body.children[0].src, "blob:test-2");
});

test("only the seeker's own resumes can be previewed", async () => {
  const env = setup();
  await env.context.previewResume("someone-elses-resume");
  assert.equal(env.modal.open, false);
  env.person.role = "recruiter";
  await env.context.previewResume("resume");
  assert.equal(env.modal.open, false);
});
