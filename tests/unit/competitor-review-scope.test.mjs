import test from "node:test";
import assert from "node:assert/strict";
import { CompetitorService } from "../../apps/api/dist/competitor-service.js";
import { MySqlCompetitorRepository } from "../../apps/api/dist/mysql-competitor-repository.js";
import { registerCompetitorRoutes } from "../../apps/api/dist/competitor-routes.js";
import Fastify from "fastify";
const organizationId = "00000000-0000-4000-8000-000000000001";
const workspaceId = "00000000-0000-4000-8000-000000000002";
const opportunityId = "00000000-0000-4000-8000-000000000003";
test("competitor opportunity filter validates identity and keeps authenticated scope", async () => {
  const calls = [];
  const service = new CompetitorService({
    list: async (input) => {
      calls.push(input);
      return [];
    },
  });
  await service.list({ organizationId, workspaceId, opportunityId });
  assert.deepEqual(calls[0], { organizationId, workspaceId, opportunityId });
  await service.list({ organizationId, workspaceId });
  assert.deepEqual(calls[1], { organizationId, workspaceId });
  for (const value of ["", "invalid", [], [opportunityId], null]) {
    assert.throws(
      () => service.list({ organizationId, workspaceId, opportunityId: value }),
      /competitor_input_invalid/,
    );
  }
  assert.equal(calls.length, 2);
});
test("scoped competitor query binds all identities and only scoped reads include review payload", async () => {
  const calls = [];
  const repo = new MySqlCompetitorRepository({
    query: async (sql, args) => {
      calls.push({ sql, args });
      return [[]];
    },
  });
  await repo.list({ organizationId, workspaceId, opportunityId });
  assert.match(calls[0].sql, /c.organization_id=\? AND c.workspace_id=\?/);
  assert.match(calls[0].sql, /AND c.opportunity_id=\?/);
  assert.match(calls[0].sql, /review_samples_json/);
  assert.deepEqual(calls[0].args, [organizationId, workspaceId, opportunityId]);
  await repo.list({ organizationId, workspaceId });
  assert.doesNotMatch(calls[1].sql, /review_samples_json|AND c.opportunity_id=\?/);
  assert.deepEqual(calls[1].args, [organizationId, workspaceId]);
});
test("competitor GET uses session tenant and existing permission while accepting opportunity query", async () => {
  const app = Fastify();
  const reads = [],
    permissions = [];
  registerCompetitorRoutes(app, {
    service: {
      list: async (input) => {
        reads.push(input);
        return [];
      },
    },
    auth: { authenticate: async () => ({ user: { id: "actor" }, session: { id: "session" } }) },
    authorization: {
      resolveSession: async () => ({
        context: { organization_id: organizationId, workspace_id: workspaceId },
      }),
      authorize: async (input) => permissions.push(input),
    },
    secureCookie: false,
    webOrigin: "http://localhost",
  });
  try {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/competitors?opportunity_id=${opportunityId}&organization_id=foreign&workspace_id=foreign`,
      headers: { cookie: "scoutops_session=test" },
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(reads[0], { organizationId, workspaceId, actorId: "actor", opportunityId });
    assert.equal(permissions[0].capability, "competitor:read");
  } finally {
    await app.close();
  }
});
