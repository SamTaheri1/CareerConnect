const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createResumeFeedbackHandler, responseText } = require('../ai/resume-feedback');
function setup(overrides = {}) {
  const calls = [];
  const resume = { name: 'resume.pdf', content: Buffer.from('%PDF example') };
  const store = { session: async () => ({ id: 'owner' }), resumeForFeedback: async () => resume };
  const handler = createResumeFeedbackHandler({
    config: { openAiApiKey: 'fake-key', openAiModel: 'fake-model', aiRequestTimeoutMs: 1000 },
    limiter: { check() {} }, store,
    fetch: async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ output_text: 'Advice' })); },
    ...overrides,
  });
  return { handler, calls, resume };
}
const context = { socket: { remoteAddress: '127.0.0.1' } };
test('feedback response parser combines text parts and ignores refusal and empty parts', () => {
  assert.equal(responseText({ output: [{ content: [{ type: 'refusal', text: 'ignore' }, { type: 'output_text', text: ' First ' }, { type: 'output_text', text: '' }] }, { content: [{ type: 'output_text', text: 'Second' }] }] }), 'First\n\nSecond');
  assert.equal(responseText({ output_text: ' Preferred ', output: [] }), 'Preferred');
  assert.equal(responseText({}), '');
});
for (const targetRole of [12, ' ', 'x'.repeat(121)]) test(`feedback rejects invalid target role ${typeof targetRole}/${String(targetRole).length} before provider access`, async () => {
  const f = setup();
  await assert.rejects(f.handler({ resumeId: 'r', targetRole }, context), e => e.status === 400);
  assert.equal(f.calls.length, 0);
});
for (const [name, content] of [['file.txt', Buffer.from('text')], ['empty.pdf', Buffer.alloc(0)], ['large.pdf', Buffer.alloc(5 * 1024 * 1024 + 1)]]) {
  test(`feedback rejects ${name} before provider access`, async () => {
    const f = setup(); Object.assign(f.resume, { name, content });
    await assert.rejects(f.handler({ resumeId: 'r' }, context), e => e.status === 400);
    assert.equal(f.calls.length, 0);
  });
}
test('feedback preserves ownership failures without calling the provider', async () => {
  for (const status of [401, 403, 404]) {
    const f = setup({ store: { session: async () => null, resumeForFeedback: async () => { throw { status }; } } });
    await assert.rejects(f.handler({ resumeId: 'r' }, context), e => e.status === status);
    assert.equal(f.calls.length, 0);
  }
});
test('feedback trims target role, attaches DOCX bytes and supplies a timeout signal', async () => {
  const f = setup(); f.resume.name = 'resume.docx';
  const result = await f.handler({ resumeId: 'r', targetRole: ' Developer ' }, context);
  const body = JSON.parse(f.calls[0].options.body);
  assert.equal(result.targetRole, 'Developer');
  assert.match(body.input[0].content[1].file_data, /^data:application\/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,/);
  assert.equal(body.store, false);
  assert.ok(f.calls[0].options.signal instanceof AbortSignal);
});
test('network and timeout failures leave the resume unchanged and hide provider details', async () => {
  for (const error of [new Error('secret provider detail'), new DOMException('secret timeout', 'TimeoutError')]) {
    const f = setup({ fetch: async () => { throw error; } });
    const before = Buffer.from(f.resume.content);
    await assert.rejects(f.handler({ resumeId: 'r' }, context), e => e.status === 503 && !e.message.includes('secret'));
    assert.deepEqual(f.resume.content, before);
  }
});
