import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../../apps/api/dist/app.js";
import {
  AuthorizationService,
  InMemoryAuthorizationRepository,
} from "../../packages/authorization/dist/index.js";

const actorId = "00000000-0000-4000-8000-000000000701";
const cookie = { cookie: "scoutops_session=valid" };

function fixture(platformCapabilities) {
  const repository = new InMemoryAuthorizationRepository();
  repository.subjects.set(repository.key(actorId), {
    actor_id: actorId,
    membership_id: null,
    membership_active: false,
    role_codes: [],
    capabilities: [],
    scopes: [{ scope: "platform" }],
    platform_role_codes: platformCapabilities.includes("platform:superadmin")
      ? ["platform_super_admin"]
      : ["platform_operations_admin"],
    platform_capabilities: platformCapabilities,
  });
  const authorization = new AuthorizationService(repository);
  const auth = {
    authenticate: async (token) => {
      if (token !== "valid") throw new Error("bad token");
      return {
        user: { id: actorId, status: "active" },
        session: { id: "00000000-0000-4000-8000-000000000702" },
      };
    },
  };
  const common = { authorization, auth, secureCookie: false, webOrigin: "http://localhost" };
  const app = buildApp({
    providerSources: {
      ...common,
      service: {
        acceptance1688: async () => ({ overall: "blocked" }),
      },
    },
    platformDashboard: {
      ...common,
      service: {
        management: async ({ domain }) => ({ domain }),
      },
    },
  });
  return { app, repository };
}

test("platform operators cannot open superadmin secondary APIs", async () => {
  const { app } = fixture(["platform:operate", "provider:configure"]);
  const acceptance = await app.inject({
    method: "GET",
    url: "/api/v1/platform/provider-sources/1688-acceptance",
    headers: cookie,
  });
  assert.equal(acceptance.statusCode, 403);
  assert.equal(acceptance.json().error.code, "permission_denied");

  const coverage = await app.inject({
    method: "GET",
    url: "/api/v1/platform/management?domain=api_coverage",
    headers: cookie,
  });
  assert.equal(coverage.statusCode, 403);
  assert.equal(coverage.json().error.code, "permission_denied");

  const status = await app.inject({
    method: "GET",
    url: "/api/v1/platform/management?domain=status",
    headers: cookie,
  });
  assert.equal(status.statusCode, 200);
  await app.close();
});

test("platform superadmins can open both secondary APIs", async () => {
  const { app, repository } = fixture(["platform:superadmin"]);
  const acceptance = await app.inject({
    method: "GET",
    url: "/api/v1/platform/provider-sources/1688-acceptance",
    headers: cookie,
  });
  assert.equal(acceptance.statusCode, 200);

  const coverage = await app.inject({
    method: "GET",
    url: "/api/v1/platform/management?domain=api_coverage",
    headers: cookie,
  });
  assert.equal(coverage.statusCode, 200);
  assert.deepEqual(
    repository.decisions.slice(-2).map((decision) => decision.capability),
    ["platform:superadmin", "platform:superadmin"],
  );
  await app.close();
});
