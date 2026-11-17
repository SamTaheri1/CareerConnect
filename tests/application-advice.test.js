const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createApplicationAdviceHandler } = require("../ai/application-advice");
const { createTestDatabase } = require("./postgres-helper");

for (const status of ["Applied", "Interview", "Under Review", "Offered", "Rejected"]) {
  test("advice sends the stored job and " + status + " status to the AI service", async () => {
    const record = { title: "Developer", description: "Build accessible sites", status };
    let sent;
    const handler = createApplicationAdviceHandler({
      config: { openAiApiKey: "private-key", openAiModel: "test-model", aiRequestTimeoutMs: 1000 },
      store: { session: async () => ({ id: "seeker" }), applicationForAdvice: async () => record },
      limiter: { check() {} },
      fetch: async (url, options) => {
        sent = options;
        return new Response(JSON.stringify({ output_text: "## Next steps\n- Prepare for the role." }));
      },
    });
    const result = await handler({ applicationId: "app", status: "Forged" }, {});
    assert.deepEqual(JSON.parse(JSON.parse(sent.body).input), record);
    assert.match(JSON.parse(sent.body).instructions, /follow up.*short draft/);
    assert.match(JSON.parse(sent.body).instructions, /three practice questions/);
    assert.equal(result.status, 200);
    assert.doesNotMatch(JSON.stringify(result), /private-key/);
  });
}

test("advice handles service errors, network failures, empty and incomplete responses", async () => {
  for (const fetch of [
    async () => new Response("{}", { status: 503 }),
    async () => { throw new Error("private provider detail"); },
    async () => new Response("invalid JSON"),
    async () => new Response("{}"),
    async () => new Response(JSON.stringify({ status: "incomplete", output_text: "partial" })),
  ]) {
    const handler = createApplicationAdviceHandler({
      config: { openAiApiKey: "key", aiRequestTimeoutMs: 1000 },
      store: { session: async () => ({ id: "seeker" }), applicationForAdvice: async () => ({ status: "Applied" }) },
      limiter: { check() {} }, fetch,
    });
    await assert.rejects(handler({ applicationId: "app" }, {}), error =>
      error.status === 503 && error.message === "Could not get next-step advice. Please try again later.");
  }
});

test("advice ownership checks reject another account before calling OpenAI", async () => {
  const db = await createTestDatabase();
  try {
    await assert.rejects(db.applicationForAdvice(null, "app"), error => error.status === 401);
    await assert.rejects(db.applicationForAdvice({ id: "recruiter", role: "recruiter" }, "app"), error => error.status === 403);
    await assert.rejects(db.applicationForAdvice({ id: "other", role: "seeker" }, "app"), error => error.status === 404);
  } finally { await db.close(); }
});
