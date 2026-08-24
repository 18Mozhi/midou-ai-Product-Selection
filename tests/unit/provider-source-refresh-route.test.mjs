import test from "node:test";
import assert from "node:assert/strict";
import {
  AuthorizationService,
  InMemoryAuthorizationRepository,
} from "../../packages/authorization/dist/index.js";
import { buildApp } from "../../apps/api/dist/app.js";

const ids = {
  actor: "00000000-0000-4000-8000-000000000101",
  session: "00000000-0000-4000-8000-000000000102",
  organization: "00000000-0000-4000-8000-000000000103",
  workspace: "00000000-0000-4000-8000-000000000104",
  otherOrganization: "00000000-0000-4000-8000-000000000105",
  task: "00000000-0000-4000-8000-000000000106",
};

function fixture(capabilities = ["trend:read"]) {
  const repository = new InMemoryAuthorizationRepository();
  repository.contexts.set(ids.session, {
    user_id: ids.actor,
    organization_id: ids.organization,
    workspace_id: ids.workspace,
  });
  repository.subjects.set(repository.key(ids.actor, ids.organization), {
    actor_id: ids.actor,
    membership_id: "00000000-0000-4000-8000-000000000107",
    membership_active: true,
    role_codes: ["member"],
    capabilities,
    scopes: [{ scope: "organization" }],
    platform_role_codes: [],
    platform_capabilities: [],
  });
  const refreshCalls = [];
  const app = buildApp({
    providerSources: {
      service: {
        refresh: async (input, context) => {
          refreshCalls.push({ input, context });
          return { task_id: ids.task, source_count: 1, status: "scheduled" };
        },
      },
      authorization: new AuthorizationService(repository),
      auth: {
        authenticate: async () => ({
          user: { id: ids.actor },
          session: { id: ids.session },
        }),
      },
      secureCookie: false,
      webOrigin: "http://127.0.0.1:5173",
    },
  });
  return { app, repository, refreshCalls };
}

const request = (payload) => ({
  method: "POST",
  url: "/api/v1/provider-sources/refresh",
  headers: {
    cookie: "scoutops_session=test",
    origin: "http://127.0.0.1:5173",
    "idempotency-key": "refresh-route-test",
    "x-request-id": "refresh-route-request",
    "x-trace-id": "refresh-route-trace",
  },
  payload,
});

test("trend reader schedules an immediate refresh in the selected session scope", async () => {
  const { app, repository, refreshCalls } = fixture();
  const response = await app.inject(
    request({ organization_id: ids.organization, workspace_id: ids.workspace }),
  );

  assert.equal(response.statusCode, 202);
  assert.equal(response.json().data.task_id, ids.task);
  assert.equal(refreshCalls.length, 1);
  assert.deepEqual(refreshCalls[0].input, {
    organization_id: ids.organization,
    workspace_id: ids.workspace,
  });
  assert.equal(refreshCalls[0].context.actorId, ids.actor);
  assert.deepEqual(
    repository.decisions.map(({ organization_id, workspace_id, outcome, reason }) => ({
      organization_id,
      workspace_id,
      outcome,
      reason,
    })),
    [
      {
        organization_id: ids.organization,
        workspace_id: ids.workspace,
        outcome: "allowed",
        reason: "allowed_scope",
      },
    ],
  );
  await app.close();
});

test("refresh rejects a body outside the selected session scope", async () => {
  const { app, refreshCalls } = fixture();
  const response = await app.inject(
    request({ organization_id: ids.otherOrganization, workspace_id: ids.workspace }),
  );

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "tenancy_context_mismatch");
  assert.equal(refreshCalls.length, 0);
  await app.close();
});

test("refresh keeps malformed scope input as a 400 validation error", async () => {
  const { app, refreshCalls } = fixture();
  const response = await app.inject(request({ organization_id: "invalid" }));

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "provider_source_scope_invalid");
  assert.equal(refreshCalls.length, 0);
  await app.close();
});

test("refresh still denies a selected-scope member without trend read permission", async () => {
  const { app, repository, refreshCalls } = fixture([]);
  const response = await app.inject(
    request({ organization_id: ids.organization, workspace_id: ids.workspace }),
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "permission_denied");
  assert.equal(repository.decisions.at(-1).reason, "capability_missing");
  assert.equal(refreshCalls.length, 0);
  await app.close();
});
