import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { UiPreferenceService } from "@scoutops/preferences";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import { sessionToken } from "./auth-routes.js";

export interface UiPreferenceRouteOptions {
  service: UiPreferenceService;
  auth: LocalAuthService;
  webOrigin: string;
  secureCookie: boolean;
}
const envelope = <T>(data: T, request: FastifyRequest) => ({
  data,
  request_id: request.headers["x-request-id"]!.toString(),
  trace_id: request.headers["x-trace-id"]!.toString(),
});
const ids = (request: FastifyRequest) => ({
  requestId: request.headers["x-request-id"]!.toString(),
  traceId: request.headers["x-trace-id"]!.toString(),
});
function assertOrigin(request: FastifyRequest, expected: string) {
  const origin = request.headers.origin;
  if (origin && origin !== expected)
    throw new ApiError(403, "origin_not_allowed", "请求来源不受信任。", "从 ScoutOps 页面重试。");
}
export function registerUiPreferenceRoutes(
  app: FastifyInstance,
  options: UiPreferenceRouteOptions,
) {
  const current = async (request: FastifyRequest) =>
    options.auth.authenticate(sessionToken(request, options.secureCookie));
  app.get("/api/v1/me/ui-preferences", async (request, reply) => {
    const authenticated = await current(request),
      scope = await options.service.scope(authenticated.session.id, authenticated.user.id);
    reply.header("cache-control", "private, no-store");
    return envelope(await options.service.get(scope), request);
  });
  app.put(
    "/api/v1/me/ui-preferences",
    {
      schema: {
        body: {
          type: "object",
          required: ["theme", "expected_version"],
          properties: {
            theme: { type: "string", enum: ["deep-ocean", "aurora-purple", "cloud-white"] },
            expected_version: { type: "integer", minimum: 0 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      assertOrigin(request, options.webOrigin);
      const authenticated = await current(request),
        scope = await options.service.scope(authenticated.session.id, authenticated.user.id),
        body = request.body as { theme: string; expected_version: number };
      const data = await options.service.update(
        { theme: body.theme, expectedVersion: body.expected_version },
        { ...scope, ...ids(request), idempotencyKey: requireIdempotencyKey(request) },
      );
      reply.header("cache-control", "private, no-store");
      return envelope(data, request);
    },
  );
}
