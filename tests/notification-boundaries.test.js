const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Database } = require('../database');
const { createTestDatabase } = require('./postgres-helper');

for (const [label, now, expected] of [
  ['exactly seven days before closing', '2026-11-12T23:59:59Z', 1],
  ['one millisecond outside seven days', '2026-11-12T23:59:58.999Z', 0],
  ['exactly at closing', '2026-11-19T23:59:59Z', 1],
  ['one millisecond after closing', '2026-11-19T23:59:59.001Z', 0],
]) test(`deadline reminder: ${label}`, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(now).getTime() });
  const inserted = [];
  const db = Object.create(Database.prototype);
  db.sql = { prepare: sql => ({
    all: async () => sql.includes('FROM saved_jobs') ? [{ id: 'job', title: 'Developer', deadline: '2026-11-19' }] : inserted,
    run: async (...values) => { inserted.push(values); },
  }) };
  await db.notifications({ id: 'seeker', role: 'seeker' });
  assert.equal(inserted.length, expected);
  if (expected) {
    assert.equal(inserted[0][1], 'seeker');
    assert.equal(inserted[0][2], 'job');
    assert.equal(inserted[0][3], 'deadline');
  }
});

test('status and deadline-change notifications persist for the correct recipients only', async t => {
  const db = await createTestDatabase();
  t.after(() => db.close());
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-19T12:00:00Z').getTime() });
  const recruiter = { id: 'owner', role: 'recruiter', name: 'Owner', email: 'owner@example.test' };
  const seeker = { id: 'candidate', role: 'seeker', name: 'Candidate', email: 'candidate@example.test' };
  const saver = { id: 'saver', role: 'seeker', name: 'Saver', email: 'saver@example.test' };
  const other = { id: 'other', role: 'seeker', name: 'Other', email: 'other@example.test' };
  for (const user of [recruiter, seeker, saver, other]) await db.add({ user, salt: 'salt', passwordHash: 'hash' });
  const job = { ...(await db.state(seeker)).jobs[0], id: 'owned', ownerId: recruiter.id, deadline: '2026-12-01' };
  await db.save(recruiter, { jobs: [job] });
  for (const user of [seeker, saver]) {
    const profile = (await db.state(user)).users[0];
    await db.save(user, { person: { ...profile, saved: [job.id] } });
  }
  await db.file(seeker, 'put', 'resume', { name: 'resume.pdf', content: Buffer.from('%PDF-1.4 test').toString('base64') });
  const app = { id: 'application', jobId: job.id, userId: seeker.id, resumeId: 'resume', name: seeker.name, email: seeker.email, note: '' };
  await db.save(seeker, { applications: [app] });
  for (const status of ['Under Review', 'Offered', 'Rejected']) {
    await db.save(recruiter, { applications: [{ ...app, status }] });
    const alerts = (await db.notifications(seeker)).filter(n => n.kind === 'status');
    assert.ok(alerts.some(n => n.applicationId === app.id && n.message.endsWith(`${status}.`)));
    const count = alerts.length;
    await db.save(recruiter, { applications: [{ ...app, status }] });
    assert.equal((await db.notifications(seeker)).filter(n => n.kind === 'status').length, count);
    t.mock.timers.tick(1000);
  }
  const before = (await db.state(seeker)).applications[0];
  await assert.rejects(db.save(recruiter, { applications: [{ ...app, status: 'Invalid' }] }), e => e.status === 400);
  assert.deepEqual((await db.state(seeker)).applications[0], before);
  assert.equal(before.history.length, 4);
  const updated = { ...job, deadline: '2026-12-02' };
  await db.save(recruiter, { jobs: [updated] });
  await db.save(recruiter, { jobs: [updated] });
  for (const user of [seeker, saver]) {
    const alerts = (await db.notifications(user)).filter(n => n.kind === 'deadline_change');
    assert.equal(alerts.length, 1);
    assert.match(alerts[0].message, /2026-12-01.*2026-12-02/);
  }
  assert.equal((await db.notifications(saver)).filter(n => n.kind === 'status').length, 0);
  assert.equal((await db.notifications(other)).length, 0);
  assert.equal((await db.notifications(recruiter)).filter(n => n.kind === 'deadline_change').length, 0);
  // Closed and archived saved postings must not create reminders even within the window.
  for (const status of ['Closed', 'Archived']) {
    await db.save(recruiter, { jobs: [{ ...updated, status, deadline: '2026-11-20' }] });
    assert.equal((await db.notifications(saver)).filter(n => n.kind === 'deadline').length, 0);
  }
});
