import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService, Capability } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { authenticatedRehearsalAccount } from "./account-read-rehearsal.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { SourcingQuoteContext, SourcingService } from "./sourcing-service.js";
export interface SourcingRouteOptions {
  service: SourcingService;
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
  env = (data: unknown, r: FastifyRequest) => ({
    data,
    request_id: ids(r).requestId,
    trace_id: ids(r).traceId,
  });
export function registerSourcingRoutes(app: FastifyInstance, o: SourcingRouteOptions) {
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
    write = async (r: FastifyRequest, capability: Capability) => {
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
      return {
        ...(await scope(r, capability)),
        ...ids(r),
        idempotencyKey: requireIdempotencyKey(r),
      };
    };
  const readScope = (r: FastifyRequest, reply: FastifyReply) => {
    if (!o.accountReadRehearsal) return scope(r, "sourcing:read");
    reply.header("cache-control", "private, no-store");
    return authenticatedRehearsalAccount(r, o.auth, o.secureCookie);
  };
  const accountWrite = async (r: FastifyRequest, reply: FastifyReply) => {
    if (r.headers.origin !== o.webOrigin)
      throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
    reply.header("cache-control", "private, no-store");
    const { accountId } = await authenticatedRehearsalAccount(r, o.auth, o.secureCookie);
    return { actorId: accountId, ...ids(r), idempotencyKey: requireIdempotencyKey(r) };
  };
  app.get("/api/v1/sourcing/searches", async (r, reply) => {
    const context = await readScope(r, reply),
      query = r.query as Record<string, unknown>;
    if (["page", "page_size", "q", "record"].some((key) => query[key] !== undefined)) {
      const result = await o.service.listPage(context, query);
      return { ...env(result.items, r), meta: result.meta };
    }
    return env(await o.service.list(context), r);
  });
  app.get("/api/v1/sourcing/searches/:id", async (r, reply) =>
    env(
      await o.service.detail({
        ...(await readScope(r, reply)),
        searchId: (r.params as any).id,
      }),
      r,
    ),
  );
  app.post("/api/v1/sourcing/searches", async (r, reply) => {
    const x = await o.service.createSearch({
      ...(o.accountReadRehearsal
        ? { ...(await accountWrite(r, reply)), accountOwnedSearch: true as const }
        : await write(r, "supplier_quote:manage")),
      value: r.body,
    });
    reply.code(202);
    return env(x, r);
  });
  if (!o.accountReadRehearsal) {
    app.post("/api/v1/sourcing/searches/:id/refresh", async (r, reply) => {
      const x = await o.service.refresh({
        ...(await write(r, "supplier_quote:manage")),
        searchId: (r.params as any).id,
      });
      reply.code(202);
      return env(x, r);
    });
  }
  app.delete("/api/v1/sourcing/searches/:id", async (r, reply) =>
    env(
      await o.service.remove({
        ...(o.accountReadRehearsal
          ? { ...(await accountWrite(r, reply)), accountOwnedSearch: true as const }
          : await write(r, "supplier_quote:manage")),
        searchId: (r.params as any).id,
        value: r.body,
      }),
      r,
    ),
  );
  app.post("/api/v1/sourcing/quotes", async (r, reply) => {
    const context: SourcingQuoteContext = o.accountReadRehearsal
      ? { ...(await accountWrite(r, reply)), accountOwnedQuote: true }
      : await write(r, "supplier_quote:manage");
    const x = await o.service.confirmQuote({
      ...context,
      value: r.body,
    });
    reply.code(201);
    return env(x, r);
  });
  app.get("/api/v1/sourcing/comparisons", async (r, reply) =>
    env(await o.service.listComparisons(await readScope(r, reply)), r),
  );
  app.post("/api/v1/sourcing/comparisons", async (r, reply) => {
    const x = await o.service.createComparison({
      ...(o.accountReadRehearsal
        ? { ...(await accountWrite(r, reply)), accountOwnedComparison: true as const }
        : await write(r, "supplier_quote:manage")),
      value: r.body,
    });
    reply.code(201);
    return env(x, r);
  });
  app.post("/api/v1/sourcing/purchase-tasks", async (r, reply) => {
    const x = await o.service.createPurchaseTask({
      ...(o.accountReadRehearsal
        ? { ...(await accountWrite(r, reply)), accountOwnedPurchase: true as const }
        : await write(r, "supplier_quote:manage")),
      value: r.body,
    });
    reply.code(202);
    return env(x, r);
  });
}
