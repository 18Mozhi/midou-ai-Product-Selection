import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService, Capability } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { ApprovalRole, CostRuleAction, ProfitService } from "./profit-service.js";
export interface ProfitRouteOptions {
  service: ProfitService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
}
const ids = (r: FastifyRequest) => ({
    requestId: r.headers["x-request-id"]!.toString(),
    traceId: r.headers["x-trace-id"]!.toString(),
  }),
  envelope = (data: unknown, r: FastifyRequest) => ({
    data,
    request_id: ids(r).requestId,
    trace_id: ids(r).traceId,
  });
export function registerProfitRoutes(app: FastifyInstance, o: ProfitRouteOptions) {
  const scope = async (r: FastifyRequest, capability: Capability) => {
      const a = await o.auth.authenticate(sessionToken(r, o.secureCookie)),
        resolved = await o.authorization.resolveSession(a.user.id, a.session.id);
      await o.authorization.authorize({
        actorId: a.user.id,
        organizationId: resolved.context.organization_id,
        workspaceId: resolved.context.workspace_id,
        capability,
        surface: "api",
        ...ids(r),
      });
      return {
        organizationId: resolved.context.organization_id,
        workspaceId: resolved.context.workspace_id,
        actorId: a.user.id,
        roleCodes: resolved.subject.role_codes,
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
  app.get("/api/v1/cost-rules", async (r) =>
    envelope(await o.service.listRules(await scope(r, "opportunity:read")), r),
  );
  app.get("/api/v1/opportunities/:id/profit-analysis", async (r) => {
    const resolved = await scope(r, "opportunity:read");
    return envelope(
      await o.service.getAnalysis({
        organizationId: resolved.organizationId,
        workspaceId: resolved.workspaceId,
        opportunityId: (r.params as { id: string }).id,
      }),
      r,
    );
  });
  app.post("/api/v1/cost-rules", async (r, reply) => {
    const result = await o.service.createRule({
      ...(await write(r, "opportunity:approve")),
      value: r.body as any,
    });
    reply.code(201);
    return envelope(result, r);
  });
  app.post("/api/v1/cost-rules/:id/actions", async (r) => {
    const value = r.body as {
      action: CostRuleAction;
      reason: string;
      expected_revision: number;
      approval_role?: ApprovalRole;
      target_rule_id?: string;
    };
    return envelope(
      await o.service.actRule({
        ...(await write(r, "opportunity:approve")),
        ruleId: (r.params as { id: string }).id,
        value,
      }),
      r,
    );
  });
  app.post("/api/v1/exchange-rates", async (r, reply) => {
    const result = await o.service.recordRate({
      ...(await write(r, "cost:confirm")),
      value: r.body as any,
    });
    reply.code(201);
    return envelope(result, r);
  });
  app.post("/api/v1/opportunities/:id/cost-inputs", async (r, reply) => {
    const result = await o.service.recordCost({
      ...(await write(r, "cost:confirm")),
      opportunityId: (r.params as { id: string }).id,
      value: r.body as any,
    });
    reply.code(201);
    return envelope(result, r);
  });
  app.post("/api/v1/opportunities/:id/profit-runs", async (r, reply) => {
    const result = await o.service.queue({
      ...(await write(r, "cost:confirm")),
      opportunityId: (r.params as { id: string }).id,
      value: r.body as any,
    });
    reply.code(202);
    return envelope(result, r);
  });
}
