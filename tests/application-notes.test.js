const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createTestDatabase } = require("./postgres-helper");

async function setup() {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "careerconnect-notes-")
  );

  const database = await createTestDatabase();

  const seeker = {
    id: "test-seeker",
    name: "Test Seeker",
    email: "seeker@example.com",
    role: "seeker"
  };

  const otherSeeker = {
    id: "other-seeker",
    name: "Other Seeker",
    email: "other@example.com",
    role: "seeker"
  };

  const recruiter = {
    id: "test-recruiter",
    name: "Test Recruiter",
    email: "recruiter@example.com",
    role: "recruiter"
  };

  for (const user of [seeker, otherSeeker, recruiter]) {
    (await database.add({
      user,
      salt: "test-salt",
      passwordHash: "test-hash"
    }));
  }
(await database.sql.prepare(`
  INSERT INTO resumes
  (id, user_id, name, size, content, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(
  "test-resume",
  seeker.id,
  "resume.pdf",
  Buffer.byteLength("%PDF-1.4 test"),
  Buffer.from("%PDF-1.4 test"),
  new Date().toISOString()
));
  (await database.sql.prepare(`
    INSERT INTO applications
    (id, job_id, user_id, resume_id, name, email,
     note, profile, resume_name, status, created_at, history)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "application-1",
    (await database.state(seeker)).jobs[0].id,
    seeker.id,
    "test-resume",
    seeker.name,
    seeker.email,
    "",
    "{}",
    "resume.pdf",
    "Applied",
    new Date().toISOString(),
    "[]"
  ));

  return {
    database,
    directory,
    seeker,
    otherSeeker,
    recruiter,
    async cleanup() {
      (await database.close());
      fs.rmSync(directory, { recursive: true, force: true });
    }
  };
}

test("AT-17.1: Job seeker can add an application note", async () => {
  const ctx = await setup();

  try {
    const note = (await ctx.database.addApplicationNote(
      ctx.seeker,
      "application-1",
      "Follow up with recruiter next week."
    ));

    assert.ok(note.id);
    assert.equal(
      note.content,
      "Follow up with recruiter next week."
    );

    const notes = (await ctx.database.getApplicationNotes(
      ctx.seeker,
      "application-1"
    ));

    assert.equal(notes.length, 1);
    assert.equal(notes[0].content, note.content);

  } finally {
    await ctx.cleanup();
  }
});

test("AT-17.2: Job seeker can edit an application note", async () => {
  const ctx = await setup();

  try {
    const note = (await ctx.database.addApplicationNote(
      ctx.seeker,
      "application-1",
      "Original note"
    ));

    (await ctx.database.updateApplicationNote(
      ctx.seeker,
      note.id,
      "Updated note"
    ));

    const notes = (await ctx.database.getApplicationNotes(
      ctx.seeker,
      "application-1"
    ));

    assert.equal(notes.length, 1);
    assert.equal(notes[0].content, "Updated note");

  } finally {
    await ctx.cleanup();
  }
});

test("AT-17.2: Job seeker can delete an application note", async () => {
  const ctx = await setup();

  try {
    const note = (await ctx.database.addApplicationNote(
      ctx.seeker,
      "application-1",
      "Delete this note"
    ));

    (await ctx.database.deleteApplicationNote(
      ctx.seeker,
      note.id
    ));

    const notes = (await ctx.database.getApplicationNotes(
      ctx.seeker,
      "application-1"
    ));

    assert.equal(notes.length, 0);

  } finally {
    await ctx.cleanup();
  }
});

test("AT-17.3: Other users cannot access private notes", async () => {
  const ctx = await setup();

  try {
    const note = (await ctx.database.addApplicationNote(
      ctx.seeker,
      "application-1",
      "Private application note"
    ));

    await assert.rejects(
      async () => (await ctx.database.getApplicationNotes(
        ctx.otherSeeker,
        "application-1"
      )),
      error => error.status === 404
    );

    await assert.rejects(
      async () => (await ctx.database.updateApplicationNote(
        ctx.otherSeeker,
        note.id,
        "Unauthorized edit"
      )),
      error => error.status === 404
    );

    await assert.rejects(
      async () => (await ctx.database.deleteApplicationNote(
        ctx.otherSeeker,
        note.id
      )),
      error => error.status === 404
    );

    await assert.rejects(
      async () => (await ctx.database.getApplicationNotes(
        ctx.recruiter,
        "application-1"
      )),
      error => error.status === 403
    );

  } finally {
    await ctx.cleanup();
  }
});

test("AT-17.3: Notes remain associated with their application", async () => {
  const ctx = await setup();

  try {
    (await ctx.database.addApplicationNote(
      ctx.seeker,
      "application-1",
      "Interview scheduled"
    ));

    (await ctx.database.addApplicationNote(
      ctx.seeker,
      "application-1",
      "Prepare interview questions"
    ));

    const notes = (await ctx.database.getApplicationNotes(
      ctx.seeker,
      "application-1"
    ));

    assert.equal(notes.length, 2);

    for (const note of notes) {
      assert.equal(note.applicationId, "application-1");
    }

  } finally {
    await ctx.cleanup();
  }
});
