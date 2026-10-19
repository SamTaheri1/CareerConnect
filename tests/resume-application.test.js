const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const workflowSource = source.slice(
  source.indexOf("async function validateResumeFile"),
  source.indexOf('document.addEventListener("submit"'),
);

class TestFormData {
  constructor(form) {
    this.values = form.values;
  }

  [Symbol.iterator]() {
    return this.values[Symbol.iterator]();
  }
}

function resumeFile(name, bytes) {
  const content = Uint8Array.from(bytes);
  return {
    name,
    size: content.byteLength,
    slice(start, end) {
      const part = content.slice(start, end);
      return {
        async arrayBuffer() {
          return part.buffer.slice(
            part.byteOffset,
            part.byteOffset + part.byteLength,
          );
        },
      };
    },
  };
}

function setup() {
  const person = {
    id: "seeker-1",
    role: "seeker",
    name: "Alex Candidate",
    email: "alex@example.com",
    profile: { headline: "Developer" },
    resumes: [],
  };
  const db = {
    applications: [],
    jobs: [{ id: "job-1", title: "Developer" }],
  };
  const files = new Map();
  const toasts = [];
  const navigations = [];
  const state = { persisted: 0, rendered: 0, modalClosed: 0, nextId: 0 };
  const context = vm.createContext({
    FormData: TestFormData,
    db,
    user: () => person,
    uid: () => `generated-${++state.nextId}`,
    isOpen: () => true,
    fileOperation: async (operation, key, value) => {
      if (operation === "get") return files.get(key) || null;
      if (operation === "put") files.set(key, value);
      if (operation === "delete") files.delete(key);
    },
    persist: () => { state.persisted += 1; },
    render: () => { state.rendered += 1; },
    toast: (message) => toasts.push(message),
    navigate: (route) => navigations.push(route),
    modal: { close: () => { state.modalClosed += 1; } },
  });
  vm.runInContext(workflowSource, context);
  return { context, db, files, navigations, person, state, toasts };
}

test("6.1–6.4: a valid PDF is checked, stored, and listed", async () => {
  const env = setup();
  const file = resumeFile("resume.pdf", [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

  await env.context.handleSubmit({
    id: "resume-form",
    values: [["resume", file]],
  });

  assert.equal(env.person.resumes.length, 1);
  assert.equal(env.person.resumes[0].name, "resume.pdf");
  assert.equal(env.files.get(env.person.resumes[0].id), file);
  assert.equal(env.state.persisted, 1);
  assert.equal(env.state.rendered, 1);
  assert.deepEqual(env.toasts, ["Resume uploaded."]);
});

test("6.3: unsupported and renamed invalid files are rejected", async () => {
  const env = setup();
  const text = resumeFile("resume.txt", [0x74, 0x65, 0x78, 0x74]);
  const fakePdf = resumeFile("resume.pdf", [0x74, 0x65, 0x78, 0x74]);

  await assert.rejects(
    env.context.handleSubmit({ id: "resume-form", values: [["resume", text]] }),
    /PDF, DOC, or DOCX/,
  );
  await assert.rejects(
    env.context.handleSubmit({ id: "resume-form", values: [["resume", fakePdf]] }),
    /content does not match its extension/,
  );
  assert.equal(env.person.resumes.length, 0);
  assert.equal(env.state.persisted, 0);
});

test("7.2: replacing a resume keeps one entry and stores the latest file", async () => {
  const env = setup();
  const oldFile = resumeFile("old.pdf", [0x25, 0x50, 0x44, 0x46, 0x2d]);
  const newFile = resumeFile("latest.pdf", [0x25, 0x50, 0x44, 0x46, 0x2d, 0x32]);
  env.person.resumes.push({
    id: "resume-1",
    name: "old.pdf",
    size: oldFile.size,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  env.files.set("resume-1", oldFile);

  await env.context.handleSubmit({
    id: "replace-resume-form",
    dataset: { id: "resume-1" },
    values: [["resume", newFile]],
  });

  assert.equal(env.person.resumes.length, 1);
  assert.equal(env.person.resumes[0].id, "resume-1");
  assert.equal(env.person.resumes[0].name, "latest.pdf");
  assert.equal(env.files.get("resume-1"), newFile);
  assert.equal(env.state.modalClosed, 1);
  assert.deepEqual(env.toasts, ["Resume replaced."]);
});

test("7.3: removing a resume deletes its metadata and stored file", async () => {
  const env = setup();
  const file = resumeFile("resume.pdf", [0x25, 0x50, 0x44, 0x46, 0x2d]);
  env.person.resumes.push({
    id: "resume-1",
    name: "resume.pdf",
    size: file.size,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  env.files.set("resume-1", file);

  await env.context.handleSubmit({
    id: "remove-resume-form",
    dataset: { id: "resume-1" },
    values: [],
  });

  assert.equal(env.person.resumes.length, 0);
  assert.equal(env.files.has("resume-1"), false);
  assert.equal(env.state.persisted, 1);
  assert.equal(env.state.modalClosed, 1);
  assert.deepEqual(env.toasts, [
    "Resume removed. Submitted applications keep their copy.",
  ]);
});

test("12.2–12.4: applying saves the application and a resume copy", async () => {
  const env = setup();
  const file = resumeFile("resume.pdf", [0x25, 0x50, 0x44, 0x46, 0x2d]);
  env.person.resumes.push({
    id: "resume-1",
    name: "resume.pdf",
    size: file.size,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  env.files.set("resume-1", file);

  await env.context.handleSubmit({
    id: "apply-form",
    dataset: { id: "job-1" },
    values: [
      ["name", "Alex Candidate"],
      ["email", "alex@example.com"],
      ["resume", "resume-1"],
      ["note", "I am interested in this role."],
    ],
  });

  assert.equal(env.db.applications.length, 1);
  const application = env.db.applications[0];
  assert.equal(application.jobId, "job-1");
  assert.equal(application.userId, "seeker-1");
  assert.equal(application.status, "Applied");
  assert.equal(application.resumeName, "resume.pdf");
  assert.equal(env.files.get(application.resumeId), file);
  assert.equal(env.state.persisted, 1);
  assert.deepEqual(env.navigations, ["applications"]);
  assert.deepEqual(env.toasts, ["Application sent. Good luck!"]);
});

test("12.3: a duplicate application is not saved", async () => {
  const env = setup();
  env.db.applications.push({ userId: "seeker-1", jobId: "job-1" });

  await assert.rejects(
    env.context.handleSubmit({
      id: "apply-form",
      dataset: { id: "job-1" },
      values: [
        ["name", "Alex Candidate"],
        ["email", "alex@example.com"],
        ["resume", "resume-1"],
        ["note", ""],
      ],
    }),
    /already applied/,
  );
  assert.equal(env.db.applications.length, 1);
  assert.equal(env.state.persisted, 0);
});
