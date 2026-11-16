import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { authenticatedRehearsalAccount } from "./account-read-rehearsal.js";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type {
  MonitoringRuleInput,
  MonitoringRuleStatus,
  TrendService,
  TrendStatus,
  TrendTopicWriteContext,
  TrendTopicChangeOperation,
  TrendTopicChangeStatus,
} from "./trend-service.js";

export interface TrendRouteOptions {
  service: TrendService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
  accountReadRehearsal?: boolean;
}
const ids = (request: FastifyRequest) => ({
  requestId: request.headers["x-request-id"]!.toString(),
  traceId: request.headers["x-trace-id"]!.toString(),
});
const envelope = (data: unknown, request: FastifyRequest, meta?: unknown) => ({
  data,
  ...(meta ? { meta } : {}),
  request_id: ids(request).requestId,
  trace_id: ids(request).traceId,
});

export function registerTrendRoutes(app: FastifyInstance, options: TrendRouteOptions) {
  const accountReadScope = (request: FastifyRequest) =>
    authenticatedRehearsalAccount(request, options.auth, options.secureCookie);
  const scope = async (request: FastifyRequest, capability: "trend:read" | "trend:manage") => {
    const authenticated = await options.auth.authenticate(
      sessionToken(request, options.secureCookie),
    );
    const resolved = await options.authorization.resolveSession(
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
  };
  const write = async (request: FastifyRequest) => {
    if (request.headers.origin !== options.webOrigin)
      throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
    return {
      ...(await scope(request, "trend:manage")),
      ...ids(request),
      idempotencyKey: requireIdempotencyKey(request),
    };
  };
  const topicWrite = async (request: FastifyRequest): Promise<TrendTopicWriteContext> => {
    if (!options.accountReadRehearsal) return write(request);
    if (request.headers.origin !== options.webOrigin)
      throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
    const { accountId } = await accountReadScope(request);
    return {
      actorId: accountId,
      accountOwnedTopic: true,
      ...ids(request),
      idempotencyKey: requireIdempotencyKey(request),
    };
  };

  app.get("/api/v1/trends", async (request, reply) => {
    if (options.accountReadRehearsal) reply.header("cache-control", "private, no-store");
    const query = request.query as Record<string, string | undefined>,
      page = Number(query.page ?? 1),
      pageSize = Number(query.page_size ?? 20);
    const listScope = options.accountReadRehearsal
      ? await accountReadScope(request)
      : await scope(request, "trend:read");
    const result = await options.service.list({
      ...listScope,
      page,
      pageSize,
      ...(query.q ? { query: query.q } : {}),
      ...(query.market ? { market: query.market } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status as TrendStatus } : {}),
      ...(query.followed === "true"
        ? { followed: true }
        : query.followed === "false"
          ? { followed: false }
          : {}),
    });
    return envelope(result.items, request, { page, page_size: pageSize, total: result.total });
  });
  app.get("/api/v1/trends/monitoring-rules", async (request, reply) => {
    if (options.accountReadRehearsal) reply.header("cache-control", "private, no-store");
    const current = options.accountReadRehearsal
      ? await accountReadScope(request)
      : await scope(request, "trend:read");
    return envelope(await options.service.listRules(current), request);
  });
  if (!options.accountReadRehearsal) {
    app.post("/api/v1/trends/monitoring-rules", async (request, reply) => {
      const result = await options.service.createRule({
        ...(await write(request)),
        rule: request.body as MonitoringRuleInput,
      });
      reply.code(201);
      return envelope(result, request);
    });
  }
  app.patch("/api/v1/trends/monitoring-rules/:id", async (request) => {
    const body = request.body as {
      status: MonitoringRuleStatus;
      expected_version: number;
      collection_interval_minutes?: number;
      recommendation_min_source_count?: number;
    };
    const context = await topicWrite(request);
    const updateContext =
      "accountOwnedTopic" in context ? { ...context, accountOwnedRule: true as const } : context;
    return envelope(
      await options.service.updateRule({
        ...updateContext,
        ruleId: (request.params as { id: string }).id,
        status: body.status,
        expectedVersion: body.expected_version,
        ...(body.collection_interval_minutes !== undefined
          ? { collectionIntervalMinutes: body.collection_interval_minutes }
          : {}),
        ...(body.recommendation_min_source_count !== undefined
          ? { recommendationMinSourceCount: body.recommendation_min_source_count }
          : {}),
      }),
      request,
    );
  });
  if (!options.accountReadRehearsal) {
    app.get("/api/v1/trends/change-requests", async (request) => {
      const query = request.query as { status?: TrendTopicChangeStatus };
      return envelope(
        await options.service.listChangeRequests({
          ...(await scope(request, "trend:manage")),
          ...(query.status ? { status: query.status } : {}),
        }),
        request,
      );
    });
    app.post("/api/v1/trends/change-requests", async (request, reply) => {
      const result = await options.service.proposeTopicChange({
        ...(await write(request)),
        value: request.body as {
          operation: TrendTopicChangeOperation;
          target_topic_id: string;
          source_topic_ids?: unknown;
          signal_ids?: unknown;
          new_title?: unknown;
          new_category?: unknown;
          expected_versions: unknown;
          reason: unknown;
        },
      });
      reply.code(201);
      return envelope(result, request);
    });
    app.post("/api/v1/trends/change-requests/:id/decisions", async (request) =>
      envelope(
        await options.service.decideTopicChange({
          ...(await write(request)),
          changeRequestId: (request.params as { id: string }).id,
          value: request.body as {
            decision: "confirm" | "reject";
            reason: unknown;
            expected_version: unknown;
          },
        }),
        request,
      ),
    );
  }
  app.get("/api/v1/trends/:id", async (request, reply) => {
    if (options.accountReadRehearsal) reply.header("cache-control", "private, no-store");
    return envelope(
      await options.service.get({
        ...(options.accountReadRehearsal
          ? await accountReadScope(request)
          : await scope(request, "trend:read")),
        topicId: (request.params as { id: string }).id,
        ...(options.accountReadRehearsal
          ? { evidencePage: (request.query as { evidence_page?: unknown }).evidence_page }
          : {}),
      }),
      request,
    );
  });
  app.put("/api/v1/trends/:id/follow", async (request, reply) => {
    if (options.accountReadRehearsal) reply.header("cache-control", "private, no-store");
    return envelope(
      await options.service.follow({
        ...(await topicWrite(request)),
        topicId: (request.params as { id: string }).id,
        followed: true,
      }),
      request,
    );
  });
  app.delete("/api/v1/trends/:id/follow", async (request, reply) => {
    if (options.accountReadRehearsal) reply.header("cache-control", "private, no-store");
    return envelope(
      await options.service.follow({
        ...(await topicWrite(request)),
        topicId: (request.params as { id: string }).id,
        followed: false,
      }),
      request,
    );
  });
  app.post("/api/v1/trends/:id/relevance", async (request, reply) => {
    if (options.accountReadRehearsal) reply.header("cache-control", "private, no-store");
    const body = request.body as {
      status: "active" | "irrelevant";
      reason: string;
      expected_version: number;
    };
    return envelope(
      await options.service.relevance({
        ...(await topicWrite(request)),
        topicId: (request.params as { id: string }).id,
        status: body.status,
        reason: body.reason,
        expectedVersion: body.expected_version,
      }),
      request,
    );
  });
}
