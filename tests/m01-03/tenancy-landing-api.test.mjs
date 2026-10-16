import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../../apps/api/dist/app.js";
import { InMemoryTenancyRepository, TenancyService } from "../../packages/tenancy/dist/index.js";
import {
  AuthorizationService,
  InMemoryAuthorizationRepository,
} from "../../packages/authorization/dist/index.js";
const user = "00000000-0000-4000-8000-000000000301";
const session = "00000000-0000-4000-8000-000000000302";
for (const role of ["member", "organization_admin", "platform_super_admin"]) {
  test(`landing API restores a new authenticated ${role} session into the member workbench`, async () => {
    const tenancyRepository = new InMemoryTenancyRepository();
    const tenancy = new TenancyService(tenancyRepository);
    const context = { actorId: user, sessionId: session, requestId: "setup", traceId: "setup" };
    const created = await tenancy.provisionOrganization(
      {
        name: "当前组织",
        slug: `landing-${role.replaceAll("_", "-")}`,
        timezone: "Asia/Shanghai",
        dataRetentionDays: 365,
        defaultWorkspaceName: "工作区",
        defaultWorkspaceSlug: "default",
      },
      context,
    );
    class Repository extends InMemoryAuthorizationRepository {
      async findSessionContext(s, u) {
        return tenancyRepository.findContext(s, u);
      }
    }
    const repository = new Repository();
    repository.subjects.set(repository.key(user, created.organization.id), {
      actor_id: user,
      membership_id: tenancyRepository.memberships[0].id,
      membership_active: true,
      role_codes: [role === "platform_super_admin" ? "member" : role],
      capabilities: ["task:read"],
      scopes: [{ scope: "organization" }],
      platform_role_codes: role === "platform_super_admin" ? [role] : [],
      platform_capabilities: role === "platform_super_admin" ? ["platform:superadmin"] : [],
    });
    const auth = {
      authenticate: async () => ({
        user: { id: user, status: "active" },
        session: { id: session },
      }),
    };
    const app = buildApp({
      authorization: {
        service: new AuthorizationService(repository),
        tenancy,
        auth,
        secureCookie: false,
      },
    });
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me/landing",
        headers: { cookie: "scoutops_session=valid" },
      });
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json().data, {
        shell: "member",
        route: "/home",
        reason: "landing_member",
      });
      assert.equal(
        (await tenancyRepository.findContext(session, user)).workspace_id,
        created.workspace.id,
      );
      assert.equal(response.headers["cache-control"], "private, no-store");
    } finally {
      await app.close();
    }
  });
}
