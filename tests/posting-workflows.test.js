const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const between = (a, b) => source.slice(source.indexOf(a), source.indexOf(b));
const fixed = '2026-11-19T12:00:00.000Z';
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [fixed])); } }
function setup() {
  const person = { id: 'owner', role: 'recruiter' };
  const db = { jobs: [], applications: [] };
  const events = { saves: 0, routes: [], dialogs: [] };
  const scope = vm.createContext({
    Date: FixedDate, db, user: () => person, uid: () => 'new-job',
    FormData: class { constructor(form) { return Object.entries(form.values); } },
    persist: async () => { events.saves++; }, render() {}, toast() {},
    navigate: route => events.routes.push(route), openModal: html => events.dialogs.push(html),
    modal: { close() {} }, icon: () => '', selectField: () => '', date: x => x,
  });
  vm.runInContext(between('const statuses', 'const main') +
    between('function e(', 'const uid') +
    between('function today()', 'function posted(') +
    between('function reviewModal(', '// Resume bytes') +
    between('async function validateResumeFile', 'document.addEventListener("submit"'), scope);
  const start = source.indexOf('} else if (action === "toggle-job"');
  vm.runInContext('async function click(action,id) { if(false) {} ' + source.slice(start + 2, source.indexOf('\n  } catch', start)) + '}', scope);
  const values = { title: 'Developer', company: 'Company', location: 'Montreal', description: 'Build apps', responsibilities: 'Build\nReview', requirements: 'JavaScript', min: '50000', max: '80000', deadline: '2026-11-19', tags: 'JS, Web' };
  const submit = (changes = {}, id) => scope.handleSubmit({ id: 'job-form', dataset: { id }, values: { ...values, ...changes } });
  return { person, db, events, scope, submit };
}
test('posting creation and editing preserve identity, ownership and creation date', async () => {
  const f = setup();
  await f.submit();
  const job = f.db.jobs[0];
  assert.equal(job.status, 'Open');
  assert.equal(job.min, 50000);
  assert.deepEqual(Array.from(job.responsibilities), ['Build', 'Review']);
  await f.submit({ title: 'Senior developer' }, job.id);
  assert.equal(f.db.jobs.length, 1);
  assert.equal(job.title, 'Senior developer');
  assert.equal(job.id, 'new-job');
  assert.equal(job.ownerId, 'owner');
  assert.equal(job.createdAt, fixed);
  assert.equal(f.events.saves, 2);
});
for (const field of ['title', 'company', 'location', 'description', 'responsibilities', 'requirements']) {
  test(`posting rejects blank ${field} without saving`, async () => {
    const f = setup();
    await assert.rejects(f.submit({ [field]: '  ' }), /required fields/);
    assert.equal(f.db.jobs.length, 0);
    assert.equal(f.events.saves, 0);
  });
}
for (const [label, changes, message] of [
  ['reversed salary', { max: '1' }, /maximum salary/],
  ['past deadline', { deadline: '2026-11-18' }, /future date/],
]) test(`posting rejects ${label} without changing an existing job`, async () => {
  const f = setup(); await f.submit();
  const before = JSON.stringify(f.db);
  await assert.rejects(f.submit(changes, 'new-job'), message);
  assert.equal(JSON.stringify(f.db), before);
  assert.equal(f.events.saves, 1);
});
test('posting actions reject seekers, signed-out users and other recruiters', async () => {
  const f = setup(); await f.submit(); const before = JSON.stringify(f.db);
  f.person.id = 'other';
  await assert.rejects(f.submit({}, 'new-job'), /not available/);
  await f.scope.click('toggle-job', 'new-job');
  f.person.role = 'seeker';
  await f.submit(); await f.scope.click('toggle-job', 'new-job');
  f.scope.user = () => null;
  await f.submit(); await f.scope.click('toggle-job', 'new-job');
  assert.equal(JSON.stringify(f.db), before);
  assert.equal(f.events.saves, 1);
});
test('close and reopen work, while expired and archived postings cannot reopen', async () => {
  const f = setup(); await f.submit(); const job = f.db.jobs[0];
  await f.scope.click('toggle-job', job.id); assert.equal(job.status, 'Closed');
  await f.scope.click('toggle-job', job.id); assert.equal(job.status, 'Open');
  job.status = 'Closed'; job.deadline = '2026-11-18';
  await f.scope.click('toggle-job', job.id); assert.equal(job.status, 'Closed');
  assert.equal(f.events.routes.at(-1), 'edit-job/new-job');
  job.status = 'Archived';
  await f.scope.click('toggle-job', job.id); assert.equal(job.status, 'Archived');
  assert.equal(f.events.saves, 3);
});
test('candidate review and status changes enforce ownership and preserve dated history', async () => {
  const f = setup(); await f.submit();
  const app = { id: 'app', jobId: 'new-job', name: '<Candidate>', email: 'a@example.test', note: '<script>', status: 'Applied', history: [{ status: 'Applied', date: '2026-11-18' }] };
  f.db.applications.push(app);
  f.scope.reviewModal('app');
  assert.match(f.events.dialogs[0], /&lt;Candidate&gt;/);
  assert.doesNotMatch(f.events.dialogs[0], /<script>/);
  const update = status => f.scope.handleSubmit({ id: 'status-form', dataset: { id: 'app' }, values: { status } });
  for (const status of ['Under Review', 'Interview', 'Offered', 'Rejected', 'Applied']) {
    await update(status);
    assert.equal(app.status, status);
    assert.equal(app.history.at(-1).date, fixed);
  }
  assert.equal(app.history.length, 6);
  await update('Applied'); assert.equal(app.history.length, 6);
  const before = JSON.stringify(app);
  await assert.rejects(update('Unknown'), /cannot update/);
  f.person.id = 'other'; f.scope.reviewModal('app');
  await assert.rejects(update('Interview'), /cannot update/);
  f.scope.reviewModal('missing');
  assert.equal(f.events.dialogs.length, 1);
  assert.equal(JSON.stringify(app), before);
  assert.equal(f.events.saves, 6);
});
