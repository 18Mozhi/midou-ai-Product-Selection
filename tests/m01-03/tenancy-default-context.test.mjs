import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryTenancyRepository, TenancyService } from "../../packages/tenancy/dist/index.js";

const user = "00000000-0000-4000-8000-000000000301";
const context = (sessionId) => ({
  actorId: user,
  sessionId,
  requestId: "restore-request",
  traceId: "restore-trace",
});
async function fixture() {
  const repository = new InMemoryTenancyRepository();
  const service = new TenancyService(repository);
  const make = (slug) =>
    service.provisionOrganization(
      {
        name: `组织 ${slug}`,
        slug,
        timezone: "Asia/Shanghai",
        dataRetentionDays: 365,
        defaultWorkspaceName: "默认工作区",
        defaultWorkspaceSlug: "default",
      },
      context("provision"),
    );
  return { repository, service, make };
}

test("login restores the last valid context to a new session and records its selection once", async () => {
  const { repository, service, make } = await fixture();
  const first = await make("first");
  const second = await make("second");
  await service.selectContext(
    { organizationId: second.organization.id, workspaceId: second.workspace.id },
    context("old"),
  );
  await service.restoreLandingContext(context("new"));
  const restored = await repository.findContext("new", user);
  assert.equal(restored.organization_id, second.organization.id);
  assert.notEqual(restored.organization_id, first.organization.id);
  const auditCount = repository.audits.length;
  await service.restoreLandingContext(context("new"));
  assert.equal(repository.audits.length, auditCount);
});

test("restoration never copies another user's context or revoked membership", async () => {
  const { repository, service, make } = await fixture();
  const first = await make("first");
  const second = await make("second");
  repository.contexts.push({
    session_id: "other",
    user_id: "another-user",
    organization_id: second.organization.id,
    workspace_id: second.workspace.id,
    selected_at: new Date(),
  });
  repository.contexts.push({
    session_id: "revoked",
    user_id: user,
    organization_id: second.organization.id,
    workspace_id: second.workspace.id,
    selected_at: new Date(),
  });
  repository.memberships.find((m) => m.organization_id === second.organization.id).status =
    "disabled";
  await service.restoreLandingContext(context("new"));
  assert.equal((await repository.findContext("new", user)).organization_id, first.organization.id);
});

test("a current selection stays current even when another session selected more recently", async () => {
  const { repository, service, make } = await fixture();
  const first = await make("first");
  const second = await make("second");
  await service.selectContext(
    { organizationId: first.organization.id, workspaceId: first.workspace.id },
    context("current"),
  );
  await service.selectContext(
    { organizationId: second.organization.id, workspaceId: second.workspace.id },
    context("other"),
  );
  await service.restoreLandingContext(context("current"));
  assert.equal(
    (await repository.findContext("current", user)).organization_id,
    first.organization.id,
  );
});

test("archived workspaces are never restored and an ambiguous account is not assigned an invented default", async () => {
  const { repository, service, make } = await fixture();
  const first = await make("first");
  await make("second");
  await service.selectContext(
    { organizationId: first.organization.id, workspaceId: first.workspace.id },
    context("old"),
  );
  repository.workspaces.find((w) => w.id === first.workspace.id).status = "archived";
  await service.restoreLandingContext(context("new"));
  assert.equal(await repository.findContext("new", user), null);
});
