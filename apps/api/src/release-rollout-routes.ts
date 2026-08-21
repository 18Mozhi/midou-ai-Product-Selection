import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import type { ReleaseRolloutService } from "./release-rollout-service.js";
import { ReleaseProbeError, type ReleaseWriteProbeService } from "./release-rollout-service.js";
import { ApiError } from "./api-foundation.js";
export interface ReleaseRolloutRouteOptions {
  service: ReleaseRolloutService;
  writeProbeService: ReleaseWriteProbeService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
}
export function registerReleaseRolloutRoutes(
  app: FastifyInstance,
  options: ReleaseRolloutRouteOptions,
) {
  app.get("/api/v1/platform/operations/releases", async (request: FastifyRequest, reply) => {
    const requestId = String(request.headers["x-request-id"]),
      traceId = String(request.headers["x-trace-id"]),
      authentication = await options.auth.authenticate(sessionToken(request, options.secureCookie));
    await options.authorization.authorize({
      actorId: authentication.user.id,
      capability: "platform:operate",
      surface: "api",
      requestId,
      traceId,
    });
    reply.header("cache-control", "private, no-store");
    return {
      data: await options.service.read({ actorId: authentication.user.id, requestId, traceId }),
      request_id: requestId,
      trace_id: traceId,
    };
  });
  app.post(
    "/api/v1/platform/operations/releases/write-probe",
    {
      schema: {
        body: {
          type: "object",
          required: ["release_id", "sample_id"],
          properties: {
            release_id: { type: "string", format: "uuid" },
            sample_id: { type: "string", format: "uuid" },
          },
          additionalProperties: false,
        },
      },
    },
    async (request: FastifyRequest, reply) => {
      const requestId = String(request.headers["x-request-id"]),
        traceId = String(request.headers["x-trace-id"]),
        body = request.body as { release_id: string; sample_id: string };
      try {
        const data = await options.writeProbeService.record({
          releaseId: body.release_id,
          sampleId: body.sample_id,
          requestId,
          traceId,
          timestamp: request.headers["x-release-probe-timestamp"],
          nonce: String(request.headers["x-release-probe-nonce"] ?? ""),
          signature: request.headers["x-release-probe-signature"],
        });
        reply.code(202).header("cache-control", "no-store");
        return { data, request_id: requestId, trace_id: traceId };
      } catch (error) {
        if (error instanceof ReleaseProbeError)
          throw new ApiError(error.statusCode, error.code, error.message, error.actionHint);
        throw error;
      }
    },
  );
}
