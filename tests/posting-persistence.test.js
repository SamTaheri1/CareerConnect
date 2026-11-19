const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./postgres-helper');

test('posting API persistence rejects invalid edits atomically and preserves ownership on valid edits', async t => {
  const db = await createTestDatabase();
  t.after(() => db.close());
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-19T12:00:00Z').getTime() });
  const owner = { id: 'owner', role: 'recruiter', name: 'Owner', email: 'owner@example.test' };
  const other = { id: 'other', role: 'recruiter', name: 'Other', email: 'other@example.test' };
  const seeker = { id: 'seeker', role: 'seeker', name: 'Seeker', email: 'seeker@example.test' };
  for (const user of [owner, other, seeker]) await db.add({ user, salt: 'salt', passwordHash: 'hash' });
  const job = { ...(await db.state(owner)).jobs[0], id: 'owned', ownerId: owner.id, deadline: '2026-11-19' };
  await db.save(owner, { jobs: [job] });
  const saved = () => db.state(owner).then(s => s.jobs.find(j => j.id === job.id));
  const before = await saved();
  for (const changes of [
    { title: '' }, { company: ' ' }, { responsibilities: [] }, { requirements: [' '] },
    { min: -1 }, { max: job.min - 1 }, { min: NaN }, { max: Infinity },
    { deadline: 'invalid' }, { deadline: '2026-11-18' }, { status: 'Invalid' },
  ]) {
    await assert.rejects(db.save(owner, { jobs: [{ ...job, ...changes }] }), e => e.status === 400);
    assert.deepEqual(await saved(), before);
  }
  for (const [user, patch, status] of [[null, {}, 401], [seeker, { ownerId: seeker.id }, 403], [other, { ownerId: other.id }, 403], [owner, { ownerId: other.id }, 403]]) {
    await assert.rejects(db.save(user, { jobs: [{ ...job, ...patch }] }), e => e.status === status);
    assert.deepEqual(await saved(), before);
  }
  await db.save(owner, { jobs: [{ ...job, title: 'Updated', status: 'Closed', deadline: '2026-11-18' }] });
  const closed = await saved();
  assert.equal(closed.title, 'Updated');
  assert.equal(closed.ownerId, owner.id);
  assert.equal(closed.id, job.id);
  await assert.rejects(db.save(owner, { jobs: [{ ...closed, status: 'Open' }] }), e => e.status === 400);
  assert.deepEqual(await saved(), closed);
  await db.save(owner, { jobs: [{ ...closed, status: 'Open', deadline: '2026-11-19' }] });
  assert.equal((await saved()).status, 'Open');
});
