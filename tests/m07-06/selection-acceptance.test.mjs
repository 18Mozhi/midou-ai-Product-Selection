import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("M07-06.A01-A06 exposes a member-scoped real selection journey", async () => {
  const [{ SelectionJourneyService }, routes, migration] = await Promise.all([
    import("../../apps/api/dist/selection-journey-service.js"),
    read("apps/api/src/selection-journey-routes.ts"),
    read("database/migrations/0028_selection_journeys_m07_06.up.sql"),
  ]);
  const created = [];
  const service = new SelectionJourneyService({
    create: async (input) => (created.push(input), { id: input.journeyId, state: "accepted" }),
    get: async () => null,
    decide: async () => ({ decision_status: "observing" }),
  });
  const result = await service.create({
    organizationId: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    actorId: "33333333-3333-4333-8333-333333333333",
    requestId: "44444444-4444-4444-8444-444444444444",
    traceId: "55555555-5555-4555-8555-555555555555",
    idempotencyKey: "m07-06-create",
    value: { input_kind: "keyword", input_value: "portable blender" },
  });
  assert.equal(result.state, "accepted");
  assert.equal(created[0].providerCode, "google_news_search");
  assert.match(routes, /task:create/);
  assert.match(routes, /opportunity:decide/);
  assert.doesNotMatch(routes, /collection:replay|provider:configure/);
  assert.match(migration, /CREATE TABLE `selection_journeys`/);
  assert.match(migration, /organization_id/);
  assert.match(migration, /workspace_id/);
  assert.doesNotMatch(migration, /utf8mb4_0900|CHECK\s*\(/i);
});

test("M07-06.A07-A17 keeps UI, contracts, production evidence and rollback synchronized", async () => {
  const files = await Promise.all([
    "apps/web/src/components/SelectionJourney.vue",
    "apps/web/src/selection-journey.css",
    "docs/openapi.yaml",
    "docs/feature-map.json",
    "config/env.example",
    "docs/architecture/m07-06-selection-acceptance.md",
    "docs/runbooks/m07-06-selection-acceptance.md",
    "verification/modules/M07-06.json",
    "verification/selection-acceptance-production-evidence.schema.json",
    "scripts/verify-selection-acceptance-production.mjs",
  ].map(read));
  const all = files.join("\n");
  for (const token of [
    "M07-06",
    "/api/v1/selection-journeys",
    "succeeded_empty",
    "blocked",
    "180000",
    "task:create",
    "opportunity:decide",
    "PROVIDER_PROXY_URL",
    "PROVIDER_PROXY_PASSWORD",
    "回滚",
  ]) assert.match(all, new RegExp(token));
  assert.match(files[0], /390/);
  assert.match(files[0], /真实来源/);
  assert.match(files[0], /没有演示数据替代真实结果/);
});

test("M07-06.A08/A12/A16 validates input and refuses deadline relaxation", async () => {
  const { SelectionJourneyService } = await import("../../apps/api/dist/selection-journey-service.js");
  const repository = { create: async (input) => input, get: async () => null, decide: async () => ({}) };
  const context = { organizationId:"11111111-1111-4111-8111-111111111111",workspaceId:"22222222-2222-4222-8222-222222222222",actorId:"33333333-3333-4333-8333-333333333333",requestId:"44444444-4444-4444-8444-444444444444",traceId:"55555555-5555-4555-8555-555555555555",idempotencyKey:"validation" };
  assert.throws(() => new SelectionJourneyService(repository, 180001), { code:"selection_deadline_contract_invalid" });
  const service = new SelectionJourneyService(repository, 180000, () => new Date("2026-08-10T12:00:00.000Z"));
  assert.throws(() => service.create({ ...context, value:{ input_kind:"asin",input_value:"short" } }), { code:"selection_asin_invalid" });
  assert.throws(() => service.create({ ...context, value:{ input_kind:"product_url",input_value:"http://example.com/product" } }), { code:"selection_product_url_invalid" });
  const accepted = await service.create({ ...context, value:{ input_kind:"product_url",input_value:"https://example.com/product" } });
  assert.equal(accepted.providerCode, "google_news_search");
  assert.equal(accepted.deadlineAt.toISOString(), "2026-08-10T12:03:00.000Z");
});

test("M07-06.A09/A16 production runner selects tenant context before member guard", async () => {
  const [runner, manifestRaw] = await Promise.all([
    read("scripts/run-baota-selection-acceptance.mjs"),
    read("infra/baota/selection-acceptance-manifest.json"),
  ]);
  const manifest = JSON.parse(manifestRaw);
  const memberships = runner.indexOf('request("/org/memberships"');
  const workspaces = runner.indexOf('request(`/org/${organization.id}/workspaces`');
  const context = runner.indexOf('request("/auth/context"');
  const guard = runner.indexOf('request("/me/navigation?shell=member"');
  assert.ok(memberships > 0, "production runner must list the account organizations after login");
  assert.ok(workspaces > memberships, "production runner must resolve a workspace from the selected organization");
  assert.ok(context > workspaces, "production runner must bind the new login session to organization/workspace context");
  assert.ok(guard > context, "member capability guard must run only after tenant context is selected");
  assert.match(runner, /"idempotency-key":randomUUID\(\)/);
  assert.equal(manifest.memberBoundary.sessionContextRequired, true);
  assert.equal(manifest.memberBoundary.exactlyOneActiveOrganization, true);
});
