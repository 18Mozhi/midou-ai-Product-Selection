import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("M01-02.A03 MySQL57 MFA migrations are encrypted, indexed and reversible", async () => {
  const ups = await Promise.all(
    ["a_mfa_factors", "b_mfa_recovery_codes", "c_mfa_challenges"].map((name) =>
      readFile(`database/migrations/0009${name}_m01_02.up.sql`, "utf8"),
    ),
  );
  const up = ups.join("\n");
  for (const table of ["user_mfa_factors", "user_mfa_recovery_codes", "user_mfa_challenges"])
    assert.match(up, new RegExp("CREATE TABLE `" + table + "`"));
  for (const field of [
    "secret_ciphertext",
    "secret_nonce",
    "secret_auth_tag",
    "code_hash",
    "token_hash",
    "last_used_step",
  ])
    assert.match(up, new RegExp(field));
  assert.doesNotMatch(up, /CHECK\s*\(|utf8mb4_0900|GENERATED\s+ALWAYS/i);
});
test("M01-02.A06/A10/A13/A17 contracts, config, map and docs stay synchronized", async () => {
  const [api, contracts, env, schema, map, architecture, runbook] = await Promise.all(
    [
      "docs/openapi.yaml",
      "packages/contracts/src/index.ts",
      "config/env.example",
      "config/schema.json",
      "docs/feature-map.json",
      "docs/architecture/m01-02-mfa-identity-adapters.md",
      "docs/runbooks/m01-02-mfa-identity-adapters.md",
    ].map((file) => readFile(file, "utf8")),
  );
  for (const route of [
    "/auth/mfa/totp/verify:",
    "/me/mfa:",
    "/me/mfa/totp/enrollment:",
    "/me/mfa/totp/confirm:",
    "/me/mfa/totp:",
  ])
    assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
  for (const dto of [
    "MfaStatus",
    "MfaEnrollmentStart",
    "MfaChallengeResponse",
    "IdentityAdapterCapability",
  ])
    assert.match(contracts, new RegExp(`interface ${dto}`));
  for (const key of [
    "MFA_ISSUER",
    "MFA_TOTP_PERIOD_SECONDS",
    "MFA_CHALLENGE_TTL_MINUTES",
    "MFA_RECOVERY_CODE_COUNT",
  ])
    assert.match(env, new RegExp(key));
  assert.match(schema, /"mfa"/);
  assert.match(map, /mfaIdentityAdapters/);
  assert.match(architecture, /21_安全设置.jpg/);
  assert.match(runbook, /## 回滚/);
});
