import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService, Capability } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { authenticatedRehearsalAccount } from "./account-read-rehearsal.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { BusinessTaskService, TaskMutationContext } from "./business-task-service.js";
export interface BusinessTaskRouteOptions {
  service: BusinessTaskService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
  accountReadRehearsal?: boolean;
}
const ids = (r: FastifyRequest) => ({
    requestId: String(r.headers["x-request-id"]),
    traceId: String(r.headers["x-trace-id"]),
  }),
  env = (data: unknown, r: FastifyRequest, meta?: unknown) => ({
    data,
    ...(meta ? { meta } : {}),
    request_id: ids(r).requestId,
    trace_id: ids(r).traceId,
  });
export function registerBusinessTaskRoutes(app: FastifyInstance, o: BusinessTaskRouteOptions) {
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
    },
    write = async (r: FastifyRequest, cap: Capability) => {
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
      return {
        ...(await scope(r, cap)),
        ...ids(r),
        idempotencyKey: requireIdempotencyKey(r),
      };
    };
  const readScope = (r: FastifyRequest, reply: FastifyReply) => {
    if (!o.accountReadRehearsal) return scope(r, "task:read");
    reply.header("cache-control", "private, no-store");
    return authenticatedRehearsalAccount(r, o.auth, o.secureCookie);
  };
  const ownedWrite = async (
    r: FastifyRequest,
    reply: FastifyReply,
    capability: Capability,
  ): Promise<TaskMutationContext> => {
    if (!o.accountReadRehearsal) return write(r, capability);
    if (r.headers.origin !== o.webOrigin)
      throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
    reply.header("cache-control", "private, no-store");
    const { accountId } = await authenticatedRehearsalAccount(r, o.auth, o.secureCookie);
    return {
      actorId: accountId,
      accountOwnedMutation: true,
      ...ids(r),
      idempotencyKey: requireIdempotencyKey(r),
    };
  };
  app.get("/api/v1/tasks", async (r, reply) => {
    const q = r.query as any,
      x = await o.service.list({
        ...(await readScope(r, reply)),
        page: q.page,
        pageSize: q.page_size,
        status: q.status,
        query: q.query,
        sort: q.sort,
        mine: q.mine,
      });
    return env(x.items, r, {
      page: x.page,
      page_size: x.page_size,
      total: x.total,
    });
  });
  app.get("/api/v1/tasks/summary", async (r, reply) =>
    env(await o.service.summary(await readScope(r, reply)), r),
  );
  if (!o.accountReadRehearsal) {
    app.get("/api/v1/tasks/member-options", async (r) =>
      env(await o.service.memberOptions(await scope(r, "task:read")), r),
    );
    app.post("/api/v1/tasks", async (r, reply) => {
      const x = await o.service.create({
        ...(await write(r, "task:create")),
        value: r.body,
      });
      reply.code(201);
      return env(x, r);
    });
  }
  app.get("/api/v1/tasks/:id", async (r, reply) =>
    env(
      await o.service.detail({
        ...(await readScope(r, reply)),
        taskId: (r.params as any).id,
      }),
      r,
    ),
  );
  app.patch("/api/v1/tasks/:id", async (r, reply) =>
    env(
      await o.service.update({
        ...(await ownedWrite(r, reply, "task:update")),
        taskId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.delete("/api/v1/tasks/:id", async (r, reply) =>
    env(
      await o.service.remove({
        ...(await ownedWrite(r, reply, "task:update")),
        taskId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.post("/api/v1/tasks/:id/comments", async (r, reply) => {
    const x = await o.service.comment({
      ...(await ownedWrite(r, reply, "task:update")),
      taskId: (r.params as any).id,
      value: r.body,
    });
    reply.code(201);
    return env(x, r);
  });
  app.post("/api/v1/tasks/:id/actions", async (r, reply) => {
    const cap = (r.body as any)?.action === "transfer" ? "task:assign" : "task:update",
      x = await o.service.action({
        ...(await ownedWrite(r, reply, cap)),
        taskId: (r.params as any).id,
        value: r.body,
      });
    reply.code(200);
    return env(x, r);
  });
}
