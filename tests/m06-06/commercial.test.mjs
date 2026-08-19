import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CommercialService, CommercialError } from "../../apps/api/dist/commercial-service.js";

const repository = new Proxy({ read: async (input) => input }, { get: (target, key) => target[key] ?? (async (input) => input) });
const service = new CommercialService(repository, 25);

test("M06-06.A01/A02/A04/A09 validates quota-only commercial boundary", async () => {
  assert.throws(() => service.createPlan({ value: { code: "Bad Code", name: "x", quotas: { price: 1 }, reason: "x" } }), (error) => error instanceof CommercialError);
  assert.throws(() => service.adjust({ value: { organization_id: "bad", assignment_id: "bad", quota_key: "money", delta_value: 1, reason: "x" } }), (error) => error instanceof CommercialError);
  assert.throws(() => service.read({ organizationId: "bad" }), (error) => error instanceof CommercialError);
  assert.throws(() => service.updatePlan({ planId: "00000000-0000-4000-8000-000000000001", value: { name: "x", quotas: { collection_tasks: 1 }, status: "active", expected_version: 0, reason: "x" } }), (error) => error instanceof CommercialError);
  assert.equal((await service.read({})).limit, 25);
});

test("M06-06.A03/A05/A10/A11/A12/A14/A16 persistence and audit", async () => {
  const all = (await Promise.all(["database/migrations/0024_commercial_operations_m06_06.up.sql", "database/migrations/0024_commercial_operations_m06_06.down.sql", "apps/api/src/mysql-commercial-repository.ts", "config/env.example"].map((path) => readFile(path, "utf8")))).join("\n");
  for (const marker of ["commercial_plans", "organization_plan_assignments", "commercial_quota_adjustments", "commercial_views", "commercial_events", "platform_audit_events", "outbox_events", "COMMERCIAL_RECENT_LIMIT"]) assert.match(all, new RegExp(marker));
  for (const forbidden of ["payment_intent", "invoice_id", "tax_rate", "credit_card"]) assert.doesNotMatch(all, new RegExp(forbidden, "i"));
});

test("M06-06.A06/A07/A08/A13/A15/A17 contracts and docs", async () => {
  const all = (await Promise.all(["docs/openapi.yaml", "docs/feature-map.json", "apps/web/src/components/CommercialOperationsCenter.vue", "apps/web/src/styles.css", "docs/architecture/m06-06-commercial.md", "docs/runbooks/m06-06-commercial.md"].map((path) => readFile(path, "utf8")))).join("\n");
  for (const marker of ["/platform/commercial", "M06-06", "loading", "empty", "rate_limited", "blocked", "390", "宝塔", "回滚", "不实现计费或支付扣款", "presentationBoundary"]) assert.match(all, new RegExp(marker.replaceAll("/", "\\/")));
});

test("M06-06.A07/A08/A13 presents the quota-only boundary truthfully", async () => {
  const center = await readFile("apps/web/src/components/CommercialOperationsCenter.vue", "utf8");
  const navigation = await readFile("apps/web/src/components/NavigationShell.vue", "utf8");
  assert.match(center, /组织配额与用量/);
  assert.match(center, /当前不包含计费、价格或支付/);
  assert.match(navigation, /label: "配额管理"/);
  assert.doesNotMatch(center, /会员、套餐、续期|确认续期\/变更|套餐与续期管理/);
});
