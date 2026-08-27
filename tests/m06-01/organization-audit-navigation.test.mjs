import test from "node:test";
import assert from "node:assert/strict";
import {
  AuthorizationService,
  InMemoryAuthorizationRepository,
} from "../../packages/authorization/dist/index.js";

const actor = "00000000-0000-4000-8000-000000000901",
  session = "00000000-0000-4000-8000-000000000902",
  organization = "00000000-0000-4000-8000-000000000903",
  workspace = "00000000-0000-4000-8000-000000000904";
const subject = (role, capabilities) => ({
  actor_id: actor,
  membership_id: "00000000-0000-4000-8000-000000000905",
  membership_active: true,
  role_codes: [role],
  capabilities,
  scopes: [{ scope: "organization" }],
  platform_role_codes: [],
  platform_capabilities: [],
});

test("M06-01 organization auditor enters only the capability-gated audit shell", async () => {
  const repository = new InMemoryAuthorizationRepository();
  repository.contexts.set(session, {
    user_id: actor,
    organization_id: organization,
    workspace_id: workspace,
  });
  repository.subjects.set(repository.key(actor, organization), subject("auditor", ["audit:read"]));
  const service = new AuthorizationService(repository, () => new Date("2026-08-27T00:00:00Z"));
  const result = await service.guardNavigationShell(actor, session, "organization_admin", {
    requestId: "auditor-navigation",
    traceId: "auditor-navigation",
  });
  assert.equal(result.guard_reason, "navigation_organization_admin_audit_allowed");
  assert.deepEqual(result.roles, ["auditor"]);
  assert.deepEqual(result.capabilities, ["audit:read"]);
  assert.equal(repository.decisions.at(-1).capability, "audit:read");
  assert.equal(repository.decisions.at(-1).outcome, "allowed");

  repository.subjects.set(repository.key(actor, organization), subject("member", ["task:read"]));
  await assert.rejects(
    () =>
      service.guardNavigationShell(actor, session, "organization_admin", {
        requestId: "member-navigation",
        traceId: "member-navigation",
      }),
    (error) => error.code === "navigation_shell_forbidden" && error.statusCode === 403,
  );
});
