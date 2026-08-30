import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SecurityOperationsService,
  SecurityOperationsError,
} from "../../apps/api/dist/security-operations-service.js";
test("M06-04.A01/A02/A04/A12 validates windows", async () => {
  const calls = [],
    s = new SecurityOperationsService({ read: async (i) => (calls.push(i), i) }, "24h", 20);
  await s.read({ window: "7d", view: "sessions", page: "2", pageSize: "10" });
  assert.equal(calls[0].windowHours, 168);
  assert.equal(calls[0].view, "sessions");
  assert.equal(calls[0].page, 2);
  assert.equal(calls[0].pageSize, 10);
  await assert.rejects(
    s.read({ window: "1y" }),
    (e) => e instanceof SecurityOperationsError && e.code === "security_operations_window_invalid",
  );
  await assert.rejects(
    s.read({ view: "other" }),
    (e) => e instanceof SecurityOperationsError && e.code === "security_operations_view_invalid",
  );
  await assert.rejects(
    s.read({ view: "events", status: "active" }),
    (e) => e instanceof SecurityOperationsError && e.code === "security_operations_status_invalid",
  );
  await assert.rejects(
    s.read({ query: "x".repeat(121) }),
    (e) => e instanceof SecurityOperationsError && e.code === "security_operations_query_invalid",
  );
  await assert.rejects(
    s.read({ pageSize: "21" }),
    (e) =>
      e instanceof SecurityOperationsError && e.code === "security_operations_page_size_invalid",
  );
});
test("M06-04.A03/A05/A09/A11/A16 sanitized audited read", async () => {
  const [up, down, repo, route] = await Promise.all(
    [
      "database/migrations/0022_security_operations_m06_04.up.sql",
      "database/migrations/0022_security_operations_m06_04.down.sql",
      "apps/api/src/mysql-security-operations-repository.ts",
      "apps/api/src/security-operations-routes.ts",
    ].map((p) => readFile(p, "utf8")),
  );
  assert.match(up, /security_operations_views/);
  assert.match(up, /utf8mb4/);
  assert.match(down, /DROP TABLE/);
  assert.match(repo, /platform\.security\.operations\.read/);
  assert.match(repo, /expires_at IS NULL OR expires_at>/);
  assert.match(repo, /THEN 'expired'/);
  assert.match(repo, /deviceSummary/);
  assert.match(repo, /LIMIT \? OFFSET \?/);
  assert.match(route, /capability:\s*["']platform:secure["']/);
  for (const secret of [
    "token_hash",
    "payload_ciphertext",
    "payload_nonce",
    "payload_auth_tag",
    "ip_hash",
    "user_agent_hash",
  ])
    assert.doesNotMatch(repo, new RegExp(`SELECT[^;]+${secret}`, "i"));
});
test("M06-04.A06/A07/A08/A10/A13/A17 contracts", async () => {
  const sources = await Promise.all(
      [
        "docs/openapi.yaml",
        "apps/web/src/components/SecurityOperationsCenter.vue",
        "apps/web/src/security-operations.css",
        "apps/web/src/styles/platform-operations.css",
        "config/env.example",
        "docs/feature-map.json",
        "docs/architecture/m06-04-security-operations.md",
        "docs/runbooks/m06-04-security-operations.md",
        "config/route-catalog.json",
        "packages/authorization/src/index.ts",
      ].map((p) => readFile(p, "utf8")),
    ),
    all = sources.join("\n");
  for (const x of [
    "/platform/security/operations",
    "loading",
    "empty",
    "expired",
    "forbidden",
    "rate_limited",
    "blocked",
    "SECURITY_OPERATIONS_DEFAULT_WINDOW",
    "M06-04",
    "宝塔",
    "回滚",
  ])
    assert.match(all, new RegExp(x.replaceAll("/", "\\/")));
  assert.match(all, /@media\s*\(\s*max-width:\s*800px\s*\)/);
  for (const copy of [
    "安全中心二级导航",
    "访问与凭证",
    "平台审计",
    "查看安全运营事实",
    "刷新数据",
    "上一页",
    "下一页",
  ])
    assert.match(sources[1], new RegExp(copy));
  assert.match(sources[8], /platform-overview[\s\S]*platform:operate[\s\S]*platform:superadmin/);
  assert.match(sources[9], /landing_platform_security/);
});
