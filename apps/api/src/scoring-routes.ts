import type { FastifyInstance, FastifyRequest } from "fastify";
import { PRIMARY_COST_APPROVER_EMAIL, type LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { authenticatedRehearsalAccount } from "./account-read-rehearsal.js";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { ScoreInput, ScoreRuleAction, ScoringService } from "./scoring-service.js";
export interface ScoringRouteOptions {
  service: ScoringService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
  accountReadRehearsal?: boolean;
}
const ids = (request: FastifyRequest) => ({
    requestId: request.headers["x-request-id"]!.toString(),
    traceId: request.headers["x-trace-id"]!.toString(),
  }),
  envelope = (data: unknown, request: FastifyRequest) => ({
    data,
    request_id: ids(request).requestId,
    trace_id: ids(request).traceId,
  });
export function registerScoringRoutes(app: FastifyInstance, options: ScoringRouteOptions) {
  const scope = async (
      request: FastifyRequest,
      capability: "opportunity:read" | "opportunity:decide" | "opportunity:approve",
    ) => {
      const authenticated = await options.auth.authenticate(
          sessionToken(request, options.secureCookie),
        ),
        resolved = await options.authorization.resolveSession(
          authenticated.user.id,
          authenticated.session.id,
        );
      await options.authorization.authorize({
        actorId: authenticated.user.id,
        organizationId: resolved.context.organization_id,
        workspaceId: resolved.context.workspace_id,
        capability,
        surface: "api",
        ...ids(request),
      });
      return {
        organizationId: resolved.context.organization_id,
        workspaceId: resolved.context.workspace_id,
        actorId: authenticated.user.id,
      };
    },
    write = async (
      request: FastifyRequest,
      capability: "opportunity:decide" | "opportunity:approve",
    ) => {
      if (request.headers.origin !== options.webOrigin)
        throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
      return {
        ...(await scope(request, capability)),
        ...ids(request),
        idempotencyKey: requireIdempotencyKey(request),
      };
    };
  app.get("/api/v1/opportunity-score-rules", async (request, reply) => {
    if (options.accountReadRehearsal) {
      reply.header("cache-control", "private, no-store");
      const { user } = await options.auth.authenticate(sessionToken(request, options.secureCookie));
      if (!user.email_verified_at)
        throw new ApiError(
          403,
          "account_verification_required",
          "账号未验证。",
          "先完成邮箱验证。",
        );
      return {
        ...envelope(await options.service.list({ accountId: user.id }), request),
        meta: { is_primary_approver: user.email_normalized === PRIMARY_COST_APPROVER_EMAIL },
      };
    }
    return envelope(await options.service.list(await scope(request, "opportunity:read")), request);
  });
  app.get("/api/v1/opportunity-score-rules/:id/preview", async (request, reply) => {
    const query = request.query as { page?: string; page_size?: string };
    if (options.accountReadRehearsal) reply.header("cache-control", "private, no-store");
    return envelope(
      await options.service.preview({
        ...(options.accountReadRehearsal
          ? await authenticatedRehearsalAccount(request, options.auth, options.secureCookie)
          : await scope(request, "opportunity:approve")),
        ruleId: (request.params as { id: string }).id,
        page: query.page == null ? 1 : Number(query.page),
        pageSize: query.page_size == null ? 20 : Number(query.page_size),
      }),
      request,
    );
  });
  app.post("/api/v1/opportunity-score-rules", async (request, reply) => {
    if (options.accountReadRehearsal) {
      reply.header("cache-control", "private, no-store");
      if (request.headers.origin !== options.webOrigin)
        throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
      const { accountId } = await authenticatedRehearsalAccount(
        request,
        options.auth,
        options.secureCookie,
      );
      const result = await options.service.accountCreate({
        ...ids(request),
        actorId: accountId,
        idempotencyKey: requireIdempotencyKey(request),
        value: request.body as any,
      });
      reply.code(201);
      return envelope(result, request);
    }
    const result = await options.service.create({
      ...(await write(request, "opportunity:decide")),
      value: request.body as any,
    });
    reply.code(201);
    return envelope(result, request);
  });
  app.post("/api/v1/opportunity-score-rules/:id/actions", async (request, reply) => {
    const value = request.body as {
      action: ScoreRuleAction;
      reason: string;
      expected_revision: number;
      target_rule_id?: string;
    };
    if (options.accountReadRehearsal) {
      reply.header("cache-control", "private, no-store");
      if (request.headers.origin !== options.webOrigin)
        throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
      const { accountId } = await authenticatedRehearsalAccount(
        request,
        options.auth,
        options.secureCookie,
      );
      return envelope(
        await options.service.accountDecision({
          ...ids(request),
          actorId: accountId,
          idempotencyKey: requireIdempotencyKey(request),
          ruleId: (request.params as { id: string }).id,
          value,
        }),
        request,
      );
    }
    return envelope(
      await options.service.action({
        ...(await write(
          request,
          value.action === "approve" ||
            value.action === "reject" ||
            value.action === "activate" ||
            value.action === "rollback"
            ? "opportunity:approve"
            : "opportunity:decide",
        )),
        ruleId: (request.params as { id: string }).id,
        value,
      }),
      request,
    );
  });
  app.post("/api/v1/opportunities/:id/score-inputs", async (request, reply) => {
    const result = await options.service.recordInput({
      ...(await write(request, "opportunity:decide")),
      opportunityId: (request.params as { id: string }).id,
      value: request.body as ScoreInput,
    });
    reply.code(201);
    return envelope(result, request);
  });
  app.post("/api/v1/opportunities/:id/score-runs", async (request, reply) => {
    const result = await options.service.queue({
      ...(await write(request, "opportunity:decide")),
      opportunityId: (request.params as { id: string }).id,
      value: request.body as { expected_version: number },
    });
    reply.code(202);
    return envelope(result, request);
  });
}
