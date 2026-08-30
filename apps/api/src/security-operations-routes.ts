import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import {
  rethrowSecurityOperationsDependency,
  type SecurityOperationsService,
} from "./security-operations-service.js";
export interface SecurityOperationsRouteOptions {
  service: SecurityOperationsService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
}
export function registerSecurityOperationsRoutes(
  app: FastifyInstance,
  o: SecurityOperationsRouteOptions,
) {
  app.get("/api/v1/platform/security/operations", async (r: FastifyRequest, reply) => {
    const requestId = String(r.headers["x-request-id"]),
      traceId = String(r.headers["x-trace-id"]);
    let actorId = "";
    try {
      const actor = await o.auth.authenticate(sessionToken(r, o.secureCookie));
      await o.authorization.authorize({
        actorId: actor.user.id,
        capability: "platform:secure",
        surface: "api",
        requestId,
        traceId,
      });
      actorId = actor.user.id;
    } catch (error) {
      rethrowSecurityOperationsDependency(error);
    }
    reply.header("cache-control", "private, no-store");
    return {
      data: await o.service.read({
        actorId,
        window: (r.query as any).window,
        view: (r.query as any).view,
        query: (r.query as any).query,
        status: (r.query as any).status,
        page: (r.query as any).page,
        pageSize: (r.query as any).page_size,
        tokenPage: (r.query as any).token_page,
        tokenPageSize: (r.query as any).token_page_size,
        requestId,
        traceId,
      }),
      request_id: requestId,
      trace_id: traceId,
    };
  });
}
