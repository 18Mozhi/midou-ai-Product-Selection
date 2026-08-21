import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import type { FileResilienceService } from "./file-resilience-service.js";
export interface FileResilienceRouteOptions {
  service: Pick<FileResilienceService, "read">;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
}
const ids = (request: FastifyRequest) => ({
  requestId: String(request.headers["x-request-id"]),
  traceId: String(request.headers["x-trace-id"]),
});
export function registerFileResilienceRoutes(
  app: FastifyInstance,
  options: FileResilienceRouteOptions,
) {
  app.get("/api/v1/platform/operations/files", async (request, reply) => {
    const correlation = ids(request),
      authentication = await options.auth.authenticate(sessionToken(request, options.secureCookie));
    await options.authorization.authorize({
      actorId: authentication.user.id,
      capability: "platform:operate",
      surface: "api",
      ...correlation,
    });
    reply.header("cache-control", "private, no-store");
    return {
      data: await options.service.read({ actorId: authentication.user.id, ...correlation }),
      request_id: correlation.requestId,
      trace_id: correlation.traceId,
    };
  });
}
