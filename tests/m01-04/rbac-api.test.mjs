import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../../apps/api/dist/app.js";
import {
  AuthorizationService,
  InMemoryAuthorizationRepository,
} from "../../packages/authorization/dist/index.js";
const actor = "00000000-0000-4000-8000-000000000411",
  org = "00000000-0000-4000-8000-000000000412",
  otherOrg = "00000000-0000-4000-8000-000000000413",
  workspace = "00000000-0000-4000-8000-000000000414",
  session = "00000000-0000-4000-8000-000000000415";
function fixture(capabilities = ["role:read"]) {
  const repository = new InMemoryAuthorizationRepository();
  repository.contexts.set(session, {
    user_id: actor,
    organization_id: org,
    workspace_id: workspace,
  });
  repository.subjects.set(repository.key(actor, org), {
    actor_id: actor,
    membership_id: "00000000-0000-4000-8000-000000000416",
    membership_active: true,
    role_codes: ["organization_admin"],
    capabilities,
    scopes: [{ scope: "organization" }],
    platform_role_codes: [],
    platform_capabilities: [],
  });
  repository.subjects.set(repository.key(actor), {
    actor_id: actor,
    membership_id: null,
    membership_active: false,
    role_codes: [],
    capabilities: [],
    scopes: [{ scope: "platform" }],
    platform_role_codes: ["platform_super_admin"],
    platform_capabilities: ["platform:superadmin"],
  });
  const auth = {
    authenticate: async (token) => {
      if (token !== "valid") throw new Error("bad token");
      return { user: { id: actor, status: "active" }, session: { id: session } };
    },
  };
  const app = buildApp({
    authorization: { service: new AuthorizationService(repository), auth, secureCookie: false },
  });
  return { app, repository };
}
const cookie = { cookie: "scoutops_session=valid" };
test("M01-04.A06/A08 own authorization reads selected server session context", async () => {
  const f = fixture();
  const response = await f.app.inject({
    method: "GET",
    url: "/api/v1/me/authorization",
    headers: cookie,
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.organization_id, org);
  assert.equal(response.json().data.workspace_id, workspace);
  assert.deepEqual(response.json().data.roles, ["organization_admin"]);
  await f.app.close();
});
test("M01-04.A06/A09 role catalog requires capability and current organization context", async () => {
  const f = fixture();
  const allowed = await f.app.inject({
    method: "GET",
    url: `/api/v1/org/${org}/roles`,
    headers: cookie,
  });
  assert.equal(allowed.statusCode, 200);
  assert.ok(allowed.json().data.some((role) => role.code === "organization_admin"));
  assert.equal(f.repository.decisions.at(-1).capability, "role:read");
  const mismatch = await f.app.inject({
    method: "GET",
    url: `/api/v1/org/${otherOrg}/roles`,
    headers: cookie,
  });
  assert.equal(mismatch.statusCode, 409);
  assert.equal(mismatch.json().error.code, "tenancy_context_mismatch");
  await f.app.close();
});
test("M01-04 platform role catalog requires superadmin and returns the authoritative matrix", async () => {
  const f = fixture();
  const allowed = await f.app.inject({
    method: "GET",
    url: "/api/v1/platform/roles",
    headers: cookie,
  });
  assert.equal(allowed.statusCode, 200);
  assert.deepEqual(
    allowed.json().data.map((role) => role.code),
    ["platform_operations_admin", "platform_security_admin", "platform_super_admin"],
  );
  assert.equal(f.repository.decisions.at(-1).capability, "platform:superadmin");
  f.repository.subjects.set(f.repository.key(actor), {
    actor_id: actor,
    membership_id: null,
    membership_active: false,
    role_codes: [],
    capabilities: [],
    scopes: [{ scope: "platform" }],
    platform_role_codes: ["platform_operations_admin"],
    platform_capabilities: ["platform:operate"],
  });
  const denied = await f.app.inject({
    method: "GET",
    url: "/api/v1/platform/roles",
    headers: cookie,
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.json().error.code, "permission_denied");
  await f.app.close();
});
test("M01-04.A09/A16 missing role is denied with sanitized traceable envelope", async () => {
  const f = fixture([]);
  const response = await f.app.inject({
    method: "GET",
    url: `/api/v1/org/${org}/roles`,
    headers: cookie,
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "permission_denied");
  assert.ok(response.json().request_id);
  assert.doesNotMatch(JSON.stringify(response.json()), /membership_id|platform_role_codes/);
  await f.app.close();
});
