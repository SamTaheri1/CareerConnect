const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { setupLocal } = require("../scripts/setup-local");
const { databaseError } = require("../database-error");

test("fresh checkout setup creates .env without overwriting existing credentials", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "careerconnect-setup-"));
  try {
    fs.writeFileSync(path.join(root, ".env.example"), "DATABASE_URL=\nDATABASE_CA_FILE=prod-ca-2021.crt\n");
    assert.match(setupLocal(root), /Created/);
    assert.match(fs.readFileSync(path.join(root, ".env"), "utf8"), /DATABASE_CA_FILE=prod-ca-2021.crt/);
    fs.writeFileSync(path.join(root, ".env"), "DATABASE_URL=private-existing-value\n");
    assert.match(setupLocal(root), /preserved/);
    assert.equal(fs.readFileSync(path.join(root, ".env"), "utf8"), "DATABASE_URL=private-existing-value\n");
  } finally { fs.rmSync(root, {recursive:true, force:true}); }
});

test("connection diagnostics never echo a driver's secret-bearing error text", () => {
  for (const code of ["28P01", "ENOTFOUND", "SELF_SIGNED_CERT_IN_CHAIN", "unknown"]) {
    assert.doesNotMatch(databaseError({code, message:"postgres://user:secret-password@host/db"}), /secret-password/);
  }
});
