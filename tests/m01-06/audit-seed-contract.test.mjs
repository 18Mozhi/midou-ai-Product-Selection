import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("M01-06.A03/A06/A10/A13/A17 contracts include seed security audit pagination and rollback", async () => {
  const [openapi, schema, env, feature, upA, downA, upB, downB, upC, downC, upD, downD, cli] =
    await Promise.all(
      [
        "docs/openapi.yaml",
        "config/schema.json",
        "config/env.example",
        "docs/feature-map.json",
        "database/migrations/0013a_user_security_setup_m01_06.up.sql",
        "database/migrations/0013a_user_security_setup_m01_06.down.sql",
        "database/migrations/0013b_platform_audit_events_m01_06.up.sql",
        "database/migrations/0013b_platform_audit_events_m01_06.down.sql",
        "database/migrations/0013c_platform_seed_runs_m01_06.up.sql",
        "database/migrations/0013c_platform_seed_runs_m01_06.down.sql",
        "database/migrations/0013d_platform_seed_state_m01_06.up.sql",
        "database/migrations/0013d_platform_seed_state_m01_06.down.sql",
        "scripts/seed-platform-admin.mjs",
      ].map((path) => readFile(path, "utf8")),
    );
  for (const value of [
    "/platform/audit-events:",
    "/organizations/{organizationId}/audit-events:",
    "/me/security-setup:",
    "SecurityAuditPageEnvelope",
    "security_setup_required",
  ])
    assert.match(openapi, new RegExp(value.replace(/[{}]/g, "\\$&")));
  const parsed = JSON.parse(schema);
  assert.ok(parsed.secretKeys.includes("PLATFORM_ADMIN_SEED_PASSWORD"));
  assert.ok(parsed.backendGroups.oneTimeSeed.includes("PLATFORM_ADMIN_SEED_EMAIL"));
  assert.match(env, /成功后必须删除/);
  assert.match(cli, /ProviderSourceService[\s\S]*ensureCatalog/);
  assert.match(feature, /auditSecurity/);
  assert.match(upA, /must_change_password/);
  assert.match(downA, /DROP COLUMN `must_change_password`/);
  assert.match(upB, /platform_audit_events/);
  assert.match(downB, /DROP TABLE/);
  assert.match(upC, /platform_seed_runs/);
  assert.match(downC, /DROP TABLE/);
  assert.match(upD, /platform-super-admin-v1/);
  assert.match(downD, /DELETE FROM/);
  assert.doesNotMatch(cli, /console\.log\([^\n]*(seed\.|email:|password:)/i);
});
