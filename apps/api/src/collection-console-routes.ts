import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import type { CollectionConsoleService } from "./collection-console-service.js";

export interface CollectionConsoleRouteOptions {
  service: CollectionConsoleService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
}

export function registerCollectionConsoleRoutes(
  app: FastifyInstance,
  options: CollectionConsoleRouteOptions,
) {
  app.get(
    "/api/v1/platform/collection/console",
    async (request: FastifyRequest, reply) => {
      const requestId = String(request.headers["x-request-id"]);
      const traceId = String(request.headers["x-trace-id"]);
      const actor = await options.auth.authenticate(
        sessionToken(request, options.secureCookie),
      );
      await options.authorization.authorize({
        actorId: actor.user.id,
        capability: "platform:operate",
        surface: "api",
        requestId,
        traceId,
      });
      const query = request.query as Record<string, unknown>;
      reply.header("cache-control", "private, no-store");
      return {
        data: await options.service.read({
          actorId: actor.user.id,
          organizationId: query.organization_id,
          workspaceId: query.workspace_id,
          providerId: query.provider_id,
          window: query.window,
          errorCode: query.error_code,
          requestId,
          traceId,
        }),
        request_id: requestId,
        trace_id: traceId,
      };
    },
  );
}
