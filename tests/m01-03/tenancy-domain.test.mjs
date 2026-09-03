import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryTenancyRepository,
  TenancyError,
  TenancyService,
} from "../../packages/tenancy/dist/index.js";

const actorA = "00000000-0000-4000-8000-000000000301";
const actorB = "00000000-0000-4000-8000-000000000302";
const baseContext = { actorId: actorA, requestId: "request-m01-03", traceId: "trace-m01-03" };
const provision = (service, slug, actorId = actorA) =>
  service.provisionOrganization(
    {
      name: `组织 ${slug}`,
      slug,
      timezone: "Asia/Shanghai",
      dataRetentionDays: 365,
      defaultWorkspaceName: "默认工作区",
      defaultWorkspaceSlug: "default",
    },
    { ...baseContext, actorId },
  );

test("M01-03.A02/A04/A11 provisions the organization aggregate and scoped audit atomically", async () => {
  const repository = new InMemoryTenancyRepository();
  const now = new Date("2026-08-07T00:00:00Z");
  const service = new TenancyService(repository, () => now);
  const result = await provision(service, "alpha");
  assert.equal(repository.organizations.length, 1);
  assert.equal(repository.workspaces.length, 1);
  assert.equal(repository.memberships.length, 1);
  assert.equal(result.organization.default_workspace_id, result.workspace.id);
  assert.equal(repository.audits[0].organization_id, result.organization.id);
  assert.equal(repository.audits[0].workspace_id, result.workspace.id);
  assert.equal(repository.audits[0].request_id, baseContext.requestId);
});

test("M01-03.A09/A12 isolates organization, workspace and team reads by active membership", async () => {
  const repository = new InMemoryTenancyRepository();
  const service = new TenancyService(repository);
  const first = await provision(service, "first");
  const second = await provision(service, "second", actorB);
  repository.teams.push({
    id: "00000000-0000-4000-8000-000000000399",
    organization_id: first.organization.id,
    name: "选品团队",
    status: "active",
    created_by: actorA,
    version: 1,
    created_at: new Date(),
    updated_at: new Date(),
  });
  assert.equal((await service.listOrganizations(actorA)).length, 1);
  assert.equal((await service.listWorkspaces(actorA, first.organization.id)).length, 1);
  assert.equal((await service.listTeams(actorA, first.organization.id)).length, 1);
  await assert.rejects(
    () => service.listWorkspaces(actorA, second.organization.id),
    (error) => error instanceof TenancyError && error.code === "organization_forbidden",
  );
});

test("M01-03.A09 archived organizations never appear as selectable memberships", async () => {
  const repository = new InMemoryTenancyRepository();
  const service = new TenancyService(repository);
  const archived = await provision(service, "archived");
  archived.organization.status = "archived";
  assert.deepEqual(await service.listOrganizations(actorA), []);
  await assert.rejects(
    () => service.listWorkspaces(actorA, archived.organization.id),
    (error) => error instanceof TenancyError && error.code === "organization_forbidden",
  );
});

test("M01-03.A12/A16 context selection rejects foreign and archived workspaces", async () => {
  const repository = new InMemoryTenancyRepository();
  const service = new TenancyService(repository);
  const first = await provision(service, "first");
  const second = await provision(service, "second");
  const context = { ...baseContext, sessionId: "00000000-0000-4000-8000-000000000398" };
  await assert.rejects(
    () =>
      service.selectContext(
        { organizationId: first.organization.id, workspaceId: second.workspace.id },
        context,
      ),
    (error) => error.code === "workspace_not_found",
  );
  second.workspace.status = "archived";
  await assert.rejects(
    () =>
      service.selectContext(
        { organizationId: second.organization.id, workspaceId: second.workspace.id },
        context,
      ),
    (error) => error.code === "workspace_archived",
  );
  const selected = await service.selectContext(
    { organizationId: first.organization.id, workspaceId: first.workspace.id },
    context,
  );
  assert.equal(selected.workspace.id, first.workspace.id);
  assert.equal(repository.contexts[0].session_id, context.sessionId);
  assert.equal(repository.audits.at(-1).action, "context.selected");
});

test("M01-03.A12/A16 validates names and detects organization slug collisions", async () => {
  const repository = new InMemoryTenancyRepository();
  const service = new TenancyService(repository);
  await provision(service, "same");
  await assert.rejects(
    () => provision(service, "same"),
    (error) => error.code === "organization_slug_conflict",
  );
  await assert.rejects(
    () =>
      service.provisionOrganization(
        {
          name: "x",
          slug: "bad slug",
          timezone: "",
          dataRetentionDays: 0,
          defaultWorkspaceName: "默认",
          defaultWorkspaceSlug: "default",
        },
        baseContext,
      ),
    (error) =>
      error.code === "invalid_timezone" ||
      error.code === "invalid_retention" ||
      error.code === "invalid_name",
  );
});

test("M01-03 self-service personal workspace provisions once and selects the current session", async () => {
  const repository = new InMemoryTenancyRepository();
  const service = new TenancyService(repository, () => new Date("2026-09-03T00:00:00Z"));
  const context = {
    actorId: actorA,
    sessionId: "00000000-0000-4000-8000-000000000397",
    requestId: "personal-workspace",
    traceId: "personal-workspace-trace",
  };
  const created = await service.provisionPersonalWorkspace(context);
  const replayedWithAnotherRequest = await service.provisionPersonalWorkspace({
    ...context,
    requestId: "personal-workspace-2",
  });
  assert.equal(created.created, true);
  assert.equal(created.workspace.name, "默认工作区");
  assert.equal(replayedWithAnotherRequest.created, false);
  assert.equal(replayedWithAnotherRequest.organization.id, created.organization.id);
  assert.equal(repository.organizations.length, 1);
  assert.equal(repository.memberships.length, 1);
  assert.equal(repository.contexts.length, 1);
  assert.equal(repository.audits.filter((item) => item.action === "context.selected").length, 2);
});
