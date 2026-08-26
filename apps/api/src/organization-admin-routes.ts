import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService, Capability } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { OrganizationAdminService } from "./organization-admin-service.js";
export interface OrganizationAdminRouteOptions {
  service: OrganizationAdminService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
}
const ids = (r: FastifyRequest) => ({
    requestId: String(r.headers["x-request-id"]),
    traceId: String(r.headers["x-trace-id"]),
  }),
  env = (data: any, r: FastifyRequest) => ({
    data,
    request_id: ids(r).requestId,
    trace_id: ids(r).traceId,
  });
export function registerOrganizationAdminRoutes(
  app: FastifyInstance,
  o: OrganizationAdminRouteOptions,
) {
  const scope = async (r: FastifyRequest, capability: Capability) => {
    const a = await o.auth.authenticate(sessionToken(r, o.secureCookie)),
      x = await o.authorization.resolveSession(a.user.id, a.session.id);
    await o.authorization.authorize({
      actorId: a.user.id,
      organizationId: x.context.organization_id,
      workspaceId: x.context.workspace_id,
      capability,
      surface: "api",
      ...ids(r),
    });
    return {
      organizationId: x.context.organization_id,
      workspaceId: x.context.workspace_id,
      actorId: a.user.id,
    };
  };
  const write = async (r: FastifyRequest, capability: Capability) => {
    if (r.headers.origin !== o.webOrigin)
      throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
    return { ...(await scope(r, capability)), ...ids(r), idempotencyKey: requireIdempotencyKey(r) };
  };
  app.get("/api/v1/org/admin/summary", async (r) =>
    env(await o.service.summary(await scope(r, "organization:manage")), r),
  );
  app.get("/api/v1/org/admin/profile", async (r) =>
    env(await o.service.profile(await scope(r, "organization:manage")), r),
  );
  app.patch("/api/v1/org/admin/profile", async (r) =>
    env(
      await o.service.updateProfile({ ...(await write(r, "organization:manage")), value: r.body }),
      r,
    ),
  );
  app.get("/api/v1/org/admin/members", async (r) =>
    env(await o.service.members(await scope(r, "membership:read")), r),
  );
  app.post("/api/v1/org/admin/invitations", async (r, reply) => {
    reply.code(202);
    return env(
      await o.service.invite({ ...(await write(r, "membership:manage")), value: r.body }),
      r,
    );
  });
  app.post("/api/v1/org/admin/invitations/:id/actions", async (r) =>
    env(
      await o.service.invitationAction({
        ...(await write(r, "membership:manage")),
        invitationId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.post("/api/v1/org/admin/members/:id/actions", async (r) =>
    env(
      await o.service.memberAction({
        ...(await write(r, "membership:manage")),
        membershipId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.get("/api/v1/org/admin/roles", async (r) =>
    env(await o.service.roles(await scope(r, "role:read")), r),
  );
  app.post("/api/v1/org/admin/members/:id/roles", async (r) =>
    env(
      await o.service.assignRole({
        ...(await write(r, "role:manage")),
        membershipId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.get("/api/v1/org/admin/workspaces", async (r) =>
    env(await o.service.workspaces(await scope(r, "workspace:manage")), r),
  );
  app.post("/api/v1/org/admin/workspaces", async (r, reply) => {
    reply.code(201);
    return env(
      await o.service.createWorkspace({ ...(await write(r, "workspace:manage")), value: r.body }),
      r,
    );
  });
  app.post("/api/v1/org/admin/workspaces/:id/actions", async (r) =>
    env(
      await o.service.workspaceAction({
        ...(await write(r, "workspace:manage")),
        workspaceId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.get("/api/v1/org/admin/teams", async (r) =>
    env(await o.service.teams(await scope(r, "team:manage")), r),
  );
  app.post("/api/v1/org/admin/teams", async (r, reply) => {
    reply.code(201);
    return env(
      await o.service.createTeam({ ...(await write(r, "team:manage")), value: r.body }),
      r,
    );
  });
  app.post("/api/v1/org/admin/teams/:id/members", async (r) =>
    env(
      await o.service.teamMemberAction({
        ...(await write(r, "team:manage")),
        teamId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.get("/api/v1/org/admin/approvals", async (r) =>
    env(await o.service.approvals(await scope(r, "opportunity:approve")), r),
  );
  app.get("/api/v1/org/admin/data", async (r) =>
    env(await o.service.data(await scope(r, "report:read")), r),
  );
  app.get("/api/v1/org/admin/tokens", async (r) =>
    env(await o.service.tokens(await scope(r, "organization_token:manage")), r),
  );
  app.post("/api/v1/org/admin/tokens", async (r, reply) => {
    reply.code(201);
    return env(
      await o.service.createToken({
        ...(await write(r, "organization_token:manage")),
        value: r.body,
      }),
      r,
    );
  });
  app.post("/api/v1/org/admin/tokens/:id/actions", async (r) =>
    env(
      await o.service.tokenAction({
        ...(await write(r, "organization_token:manage")),
        tokenId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
}
