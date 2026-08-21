import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import type { BackupRecoveryService } from "./backup-recovery-service.js";

export interface BackupRecoveryRouteOptions {
  service: BackupRecoveryService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
}

export function registerBackupRecoveryRoutes(
  app: FastifyInstance,
  options: BackupRecoveryRouteOptions,
) {
  app.get("/api/v1/platform/operations/backup-recovery", async (request: FastifyRequest, reply) => {
    const requestId = String(request.headers["x-request-id"]),
      traceId = String(request.headers["x-trace-id"]);
    const authentication = await options.auth.authenticate(
      sessionToken(request, options.secureCookie),
    );
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
}
