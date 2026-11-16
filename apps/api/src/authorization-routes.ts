import type { FastifyInstance, FastifyRequest } from "fastify";
import { AuthError, LocalAuthService } from "@scoutops/auth";
import {
  AuthorizationError,
  AuthorizationService,
  type NavigationShell,
} from "@scoutops/authorization";
import type { TenancyService } from "@scoutops/tenancy";
import { ApiError } from "./api-foundation.js";
export interface AuthorizationRouteOptions {
  tenancy?: TenancyService;
  service: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  accountRehearsalReady?: () => Promise<void>;
}
const requireVerifiedAccount = (user: { email_verified_at: unknown }) => {
  if (!user.email_verified_at)
    throw new ApiError(403, "account_verification_required", "账号未验证。", "先完成邮箱验证。");
};
const cookieName = (secure: boolean) => (secure ? "__Host-scoutops_session" : "scoutops_session");
function sessionToken(request: FastifyRequest, secure: boolean) {
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === cookieName(secure)) return decodeURIComponent(value.join("="));
  }
  throw new AuthError("session_invalid", 401, "重新登录后重试。");
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
export function registerAuthorizationRoutes(
  app: FastifyInstance,
  options: AuthorizationRouteOptions,
) {
  const current = async (request: FastifyRequest) =>
    options.auth.authenticate(sessionToken(request, options.secureCookie));
  app.get("/api/v1/me/authorization", async (request, reply) => {
    const authenticated = await current(request);
    reply.header("cache-control", options.accountRehearsalReady ? "private, no-store" : "no-store");
    if (options.accountRehearsalReady) {
      requireVerifiedAccount(authenticated.user);
      await options.accountRehearsalReady();
      return envelope(await options.service.describeAccount(authenticated.user.id), request);
    }
    return envelope(
      await options.service.describeSession(authenticated.user.id, authenticated.session.id),
      request,
    );
  });
  app.get("/api/v1/me/landing", async (request, reply) => {
    const authenticated = await current(request);
    reply.header("cache-control", "private, no-store");
    if (options.accountRehearsalReady) {
      requireVerifiedAccount(authenticated.user);
      await options.accountRehearsalReady();
      const reason = "landing_account_rehearsal";
      await options.service.recordAccountRehearsalNavigation(
        authenticated.user.id,
        reason,
        ids(request),
      );
      return envelope({ shell: "member", route: "/opportunities", reason }, request);
    }
    await options.tenancy?.restoreLandingContext({
      actorId: authenticated.user.id,
      sessionId: authenticated.session.id,
      ...ids(request),
    });
    return envelope(
      await options.service.resolveLanding(
        authenticated.user.id,
        authenticated.session.id,
        ids(request),
      ),
      request,
    );
  });
  app.get(
    "/api/v1/me/navigation",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["shell"],
          properties: {
            shell: { type: "string", enum: ["member", "organization_admin", "platform_admin"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const authenticated = await current(request),
        { shell } = request.query as { shell: NavigationShell };
      reply.header("cache-control", "private, no-store");
      if (options.accountRehearsalReady && shell !== "platform_admin") {
        requireVerifiedAccount(authenticated.user);
        if (shell === "organization_admin") {
          await options.service.recordAccountRehearsalNavigation(
            authenticated.user.id,
            "navigation_organization_retired_in_rehearsal",
            ids(request),
          );
          throw new AuthorizationError(
            "navigation_shell_forbidden",
            403,
            "账号演练不提供组织后台。",
          );
        }
        await options.accountRehearsalReady();
        const reason = "navigation_account_rehearsal";
        const { roles, capabilities, platform_roles, platform_capabilities } =
          await options.service.describeAccount(authenticated.user.id);
        await options.service.recordAccountRehearsalNavigation(
          authenticated.user.id,
          reason,
          ids(request),
        );
        return envelope(
          {
            shell,
            organization_id: null,
            workspace_id: null,
            organization_name: null,
            workspace_name: null,
            roles,
            capabilities,
            platform_roles,
            platform_capabilities,
            guard_reason: reason,
          },
          request,
        );
      }
      const navigation = await options.service.guardNavigationShell(
        authenticated.user.id,
        authenticated.session.id,
        shell,
        ids(request),
      );
      return envelope(
        options.accountRehearsalReady ? { ...navigation, account_rehearsal: true } : navigation,
        request,
      );
    },
  );
  app.get("/api/v1/platform/roles", async (request, reply) => {
    const authenticated = await current(request);
    await options.service.authorize({
      actorId: authenticated.user.id,
      capability: "platform:superadmin",
      surface: "api",
      ...ids(request),
    });
    reply.header("cache-control", "no-store");
    return envelope(await options.service.listRoles("platform"), request);
  });
  if (options.accountRehearsalReady) return;
  app.get(
    "/api/v1/org/:organizationId/roles",
    {
      schema: {
        params: {
          type: "object",
          required: ["organizationId"],
          properties: { organizationId: { type: "string", format: "uuid" } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const authenticated = await current(request),
        { organizationId } = request.params as { organizationId: string };
      const context = await options.service.describeSession(
        authenticated.user.id,
        authenticated.session.id,
      );
      if (context.organization_id !== organizationId)
        throw new AuthorizationError("tenancy_context_mismatch", 409, "先切换到目标组织。");
      await options.service.authorize({
        actorId: authenticated.user.id,
        organizationId,
        capability: "role:read",
        surface: "api",
        ...ids(request),
      });
      reply.header("cache-control", "no-store");
      return envelope(await options.service.listRoles("organization"), request);
    },
  );
}
