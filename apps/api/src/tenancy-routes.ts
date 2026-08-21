import type { FastifyInstance, FastifyRequest } from "fastify";
import { AuthError, LocalAuthService, digestOpaqueToken } from "@scoutops/auth";
import { TenancyService } from "@scoutops/tenancy";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { AuthIdempotency, IdempotentResponse } from "./auth-routes.js";

export interface TenancyRouteOptions {
  service: TenancyService;
  auth: LocalAuthService;
  idempotency: AuthIdempotency;
  webOrigin: string;
  secureCookie: boolean;
}
const cookieName = (secure: boolean) => (secure ? "__Host-scoutops_session" : "scoutops_session");
const bodySchema = (required: string[], properties: Record<string, unknown>) => ({
  type: "object",
  required,
  properties,
  additionalProperties: false,
});
const envelope = <T>(data: T, request: FastifyRequest) => ({
  data,
  request_id: request.headers["x-request-id"]!.toString(),
  trace_id: request.headers["x-trace-id"]!.toString(),
});
function cookieValue(request: FastifyRequest, name: string) {
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const [index, ...rest] = part.trim().split("=");
    if (index === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}
function sessionToken(request: FastifyRequest, secure: boolean) {
  const token = cookieValue(request, cookieName(secure));
  if (!token) throw new AuthError("session_invalid", 401, "重新登录后重试。");
  return token;
}
function assertOrigin(request: FastifyRequest, expected: string) {
  const origin = request.headers.origin;
  if (origin && origin !== expected)
    throw new ApiError(403, "origin_not_allowed", "请求来源不受信任。", "从 ScoutOps 页面重试。");
}
const ids = (request: FastifyRequest) => ({
  requestId: request.headers["x-request-id"]!.toString(),
  traceId: request.headers["x-trace-id"]!.toString(),
});
const paramsSchema = {
  type: "object",
  required: ["organizationId"],
  properties: { organizationId: { type: "string", format: "uuid" } },
  additionalProperties: false,
};

export function registerTenancyRoutes(app: FastifyInstance, options: TenancyRouteOptions) {
  const current = async (request: FastifyRequest) => {
    const token = sessionToken(request, options.secureCookie);
    const authenticated = await options.auth.authenticate(token);
    return { token, ...authenticated };
  };
  app.get("/api/v1/org/memberships", async (request, reply) => {
    const authenticated = await current(request);
    reply.header("cache-control", "no-store");
    return envelope(await options.service.listOrganizations(authenticated.user.id), request);
  });
  app.get(
    "/api/v1/org/:organizationId/workspaces",
    { schema: { params: paramsSchema } },
    async (request, reply) => {
      const authenticated = await current(request);
      const { organizationId } = request.params as { organizationId: string };
      reply.header("cache-control", "no-store");
      return envelope(
        await options.service.listWorkspaces(authenticated.user.id, organizationId),
        request,
      );
    },
  );
  app.get(
    "/api/v1/org/:organizationId/teams",
    { schema: { params: paramsSchema } },
    async (request, reply) => {
      const authenticated = await current(request);
      const { organizationId } = request.params as { organizationId: string };
      reply.header("cache-control", "no-store");
      return envelope(
        await options.service.listTeams(authenticated.user.id, organizationId),
        request,
      );
    },
  );
  app.post(
    "/api/v1/auth/context",
    {
      schema: {
        body: bodySchema(["organization_id", "workspace_id"], {
          organization_id: { type: "string", format: "uuid" },
          workspace_id: { type: "string", format: "uuid" },
        }),
      },
    },
    async (request, reply) => {
      assertOrigin(request, options.webOrigin);
      const authenticated = await current(request);
      const body = request.body as { organization_id: string; workspace_id: string };
      const requestIds = ids(request);
      const result = await options.idempotency.execute(
        {
          scope: `session:${digestOpaqueToken(authenticated.token)}`,
          route: "/auth/context",
          method: "POST",
          key: requireIdempotencyKey(request),
          requestId: requestIds.requestId,
          traceId: requestIds.traceId,
        },
        async (): Promise<IdempotentResponse> => ({
          status: 200,
          body: envelope(
            await options.service.selectContext(
              { organizationId: body.organization_id, workspaceId: body.workspace_id },
              {
                actorId: authenticated.user.id,
                sessionId: authenticated.session.id,
                ...requestIds,
              },
            ),
            request,
          ),
        }),
      );
      reply.code(result.status).header("cache-control", "no-store");
      if (result.replayed) reply.header("idempotency-replayed", "true");
      return result.body;
    },
  );
}
