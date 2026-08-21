import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  AuthError,
  LocalAuthService,
  MfaService,
  digestOpaqueToken,
  normalizeEmail,
  type AuthContext,
} from "@scoutops/auth";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";

export interface IdempotentResponse<T = unknown> {
  status: number;
  body: T;
  replayed?: boolean;
}
export interface AuthIdempotency {
  execute<T>(
    input: {
      scope: string;
      route: string;
      method: "POST" | "DELETE";
      key: string;
      requestId: string;
      traceId: string;
    },
    work: () => Promise<IdempotentResponse<T>>,
  ): Promise<IdempotentResponse<T>>;
  executeSensitive<T>(
    input: {
      scope: string;
      route: string;
      method: "POST" | "DELETE";
      key: string;
      requestId: string;
      traceId: string;
    },
    work: () => Promise<IdempotentResponse<T>>,
  ): Promise<IdempotentResponse<T>>;
}
export interface LocalAuthRouteOptions {
  service: LocalAuthService;
  idempotency: AuthIdempotency;
  webOrigin: string;
  secureCookie: boolean;
  sessionTtlMinutes?: number;
  mfa?: MfaService;
}

const cookieName = (secure: boolean) => (secure ? "__Host-scoutops_session" : "scoutops_session");
const challengeCookieName = (secure: boolean) =>
  secure ? "__Host-scoutops_mfa_challenge" : "scoutops_mfa_challenge";
const bodySchema = (required: string[], properties: Record<string, unknown>) => ({
  type: "object",
  required,
  properties,
  additionalProperties: false,
});
const requestIds = (request: FastifyRequest): AuthContext => ({
  requestId: request.headers["x-request-id"]!.toString(),
  traceId: request.headers["x-trace-id"]!.toString(),
  ...(request.headers["user-agent"] ? { userAgent: request.headers["user-agent"] } : {}),
  ipAddress: request.ip,
});
const envelope = <T>(data: T, request: FastifyRequest) => ({
  data,
  request_id: request.headers["x-request-id"]!.toString(),
  trace_id: request.headers["x-trace-id"]!.toString(),
});
function cookieValue(request: FastifyRequest, name: string) {
  const cookies = Object.fromEntries(
    (request.headers.cookie ?? "")
      .split(";")
      .map((part) => part.trim().split("=").map(decodeURIComponent))
      .filter((pair) => pair.length === 2),
  );
  return cookies[name];
}
export function sessionToken(request: FastifyRequest, secure: boolean) {
  const token = cookieValue(request, cookieName(secure));
  if (!token) throw new AuthError("session_invalid", 401, "重新登录后重试。");
  return token;
}
function assertOrigin(request: FastifyRequest, expected: string) {
  const origin = request.headers.origin;
  if (origin && origin !== expected)
    throw new ApiError(403, "origin_not_allowed", "请求来源不受信任。", "从 ScoutOps 页面重试。");
}
function setSessionCookie(reply: FastifyReply, token: string, secure: boolean, ttlMinutes = 43200) {
  reply
    .header(
      "set-cookie",
      `${cookieName(secure)}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(ttlMinutes * 60)}${secure ? "; Secure" : ""}`,
    )
    .header("cache-control", "no-store");
}
function clearSessionCookie(reply: FastifyReply, secure: boolean) {
  reply
    .header(
      "set-cookie",
      `${cookieName(secure)}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`,
    )
    .header("cache-control", "no-store")
    .header("clear-site-data", '"cache", "cookies", "storage"');
}
function setChallengeCookie(reply: FastifyReply, token: string, secure: boolean) {
  reply
    .header(
      "set-cookie",
      `${challengeCookieName(secure)}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=600${secure ? "; Secure" : ""}`,
    )
    .header("cache-control", "no-store");
}
function setSessionAndClearChallenge(
  reply: FastifyReply,
  token: string,
  secure: boolean,
  ttlMinutes = 43200,
) {
  reply
    .header("set-cookie", [
      `${cookieName(secure)}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(ttlMinutes * 60)}${secure ? "; Secure" : ""}`,
      `${challengeCookieName(secure)}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`,
    ])
    .header("cache-control", "no-store");
}

export function registerLocalAuthRoutes(app: FastifyInstance, options: LocalAuthRouteOptions) {
  const write = async <T>(
    request: FastifyRequest,
    scope: string,
    route: string,
    method: "POST" | "DELETE",
    work: () => Promise<IdempotentResponse<T>>,
  ) =>
    options.idempotency.execute(
      {
        scope,
        route,
        method,
        key: requireIdempotencyKey(request),
        requestId: request.headers["x-request-id"]!.toString(),
        traceId: request.headers["x-trace-id"]!.toString(),
      },
      work,
    );
  const sensitiveWrite = async <T>(
    request: FastifyRequest,
    scope: string,
    route: string,
    method: "POST" | "DELETE",
    work: () => Promise<IdempotentResponse<T>>,
  ) =>
    options.idempotency.executeSensitive(
      {
        scope,
        route,
        method,
        key: requireIdempotencyKey(request),
        requestId: request.headers["x-request-id"]!.toString(),
        traceId: request.headers["x-trace-id"]!.toString(),
      },
      work,
    );

  app.post(
    "/api/v1/auth/register",
    {
      schema: {
        body: bodySchema(["email", "password"], {
          email: { type: "string", maxLength: 254 },
          password: { type: "string", maxLength: 1024 },
        }),
      },
    },
    async (request, reply) => {
      assertOrigin(request, options.webOrigin);
      const body = request.body as { email: string; password: string };
      const result = await write(
        request,
        `email:${normalizeEmail(body.email)}`,
        "/auth/register",
        "POST",
        async () => ({
          status: 201,
          body: envelope(await options.service.register(body, requestIds(request)), request),
        }),
      );
      reply.code(result.status);
      if (result.replayed) reply.header("idempotency-replayed", "true");
      return result.body;
    },
  );
  app.post(
    "/api/v1/auth/email-verification/confirm",
    {
      schema: {
        body: bodySchema(["token"], { token: { type: "string", minLength: 20, maxLength: 512 } }),
      },
    },
    async (request, reply) => {
      assertOrigin(request, options.webOrigin);
      const body = request.body as { token: string };
      const result = await write(
        request,
        `action:${digestOpaqueToken(body.token)}`,
        "/auth/email-verification/confirm",
        "POST",
        async () => ({
          status: 200,
          body: envelope(
            { status: await options.service.verifyEmail(body.token, requestIds(request)) },
            request,
          ),
        }),
      );
      reply.code(result.status);
      return result.body;
    },
  );
  app.post(
    "/api/v1/auth/login",
    {
      schema: {
        body: bodySchema(["email", "password"], {
          email: { type: "string", maxLength: 254 },
          password: { type: "string", maxLength: 1024 },
        }),
      },
    },
    async (request, reply) => {
      assertOrigin(request, options.webOrigin);
      const body = request.body as { email: string; password: string };
      const login = await options.service.login(body, requestIds(request));
      if ("mfa_required" in login) {
        setChallengeCookie(reply, login.challenge_token, options.secureCookie);
        reply.code(202);
        return envelope({ mfa_required: true, expires_at: login.expires_at }, request);
      }
      setSessionCookie(reply, login.token, options.secureCookie, options.sessionTtlMinutes);
      return envelope(
        { user: login.user, session: login.session, security_setup: login.security_setup },
        request,
      );
    },
  );
  app.post("/api/v1/auth/logout", async (request, reply) => {
    assertOrigin(request, options.webOrigin);
    const token = sessionToken(request, options.secureCookie);
    const result = await write(
      request,
      `session:${digestOpaqueToken(token)}`,
      "/auth/logout",
      "POST",
      async () => {
        await options.service.logout(token, requestIds(request));
        return { status: 204, body: null };
      },
    );
    clearSessionCookie(reply, options.secureCookie);
    reply.code(result.status);
    return result.body;
  });
  app.post(
    "/api/v1/auth/password-reset/request",
    { schema: { body: bodySchema(["email"], { email: { type: "string", maxLength: 254 } }) } },
    async (request, reply) => {
      assertOrigin(request, options.webOrigin);
      const body = request.body as { email: string };
      const result = await write(
        request,
        `email:${normalizeEmail(body.email)}`,
        "/auth/password-reset/request",
        "POST",
        async () => ({
          status: 202,
          body: envelope(
            await options.service.requestPasswordReset(body.email, requestIds(request)),
            request,
          ),
        }),
      );
      reply.code(result.status);
      return result.body;
    },
  );
  app.post(
    "/api/v1/auth/password-reset/confirm",
    {
      schema: {
        body: bodySchema(["token", "new_password"], {
          token: { type: "string", minLength: 20, maxLength: 512 },
          new_password: { type: "string", maxLength: 1024 },
        }),
      },
    },
    async (request, reply) => {
      assertOrigin(request, options.webOrigin);
      const body = request.body as { token: string; new_password: string };
      const result = await write(
        request,
        `action:${digestOpaqueToken(body.token)}`,
        "/auth/password-reset/confirm",
        "POST",
        async () => {
          await options.service.resetPassword(body.token, body.new_password, requestIds(request));
          return { status: 204, body: null };
        },
      );
      reply.code(result.status);
      return result.body;
    },
  );
  app.post(
    "/api/v1/me/password",
    {
      schema: {
        body: bodySchema(["current_password", "new_password"], {
          current_password: { type: "string", maxLength: 1024 },
          new_password: { type: "string", maxLength: 1024 },
        }),
      },
    },
    async (request, reply) => {
      assertOrigin(request, options.webOrigin);
      const token = sessionToken(request, options.secureCookie);
      const body = request.body as { current_password: string; new_password: string };
      const result = await write(
        request,
        `session:${digestOpaqueToken(token)}`,
        "/me/password",
        "POST",
        async () => {
          await options.service.changePassword(
            token,
            body.current_password,
            body.new_password,
            requestIds(request),
          );
          return { status: 204, body: null };
        },
      );
      clearSessionCookie(reply, options.secureCookie);
      reply.code(result.status);
      return result.body;
    },
  );
  app.get("/api/v1/me/security-setup", async (request) =>
    envelope(
      await options.service.securitySetupStatus(sessionToken(request, options.secureCookie)),
      request,
    ),
  );
  app.get("/api/v1/me/sessions", async (request) =>
    envelope(
      await options.service.listSessions(sessionToken(request, options.secureCookie)),
      request,
    ),
  );
  app.delete(
    "/api/v1/me/sessions/:sessionId",
    {
      schema: {
        params: {
          type: "object",
          required: ["sessionId"],
          properties: { sessionId: { type: "string", format: "uuid" } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      assertOrigin(request, options.webOrigin);
      const token = sessionToken(request, options.secureCookie);
      const { sessionId } = request.params as { sessionId: string };
      const result = await write(
        request,
        `session:${digestOpaqueToken(token)}`,
        "/me/sessions/{sessionId}",
        "DELETE",
        async () => {
          await options.service.revokeSession(token, sessionId, requestIds(request));
          return { status: 204, body: null };
        },
      );
      reply.code(result.status);
      return result.body;
    },
  );
  if (options.mfa) {
    app.get("/api/v1/me/mfa", async (request) => {
      const authenticated = await options.service.authenticate(
        sessionToken(request, options.secureCookie),
        { allowSecuritySetup: true },
      );
      return envelope(await options.mfa!.status(authenticated.user.id), request);
    });
    app.post(
      "/api/v1/me/mfa/totp/enrollment",
      {
        schema: {
          body: bodySchema(["current_password"], {
            current_password: { type: "string", maxLength: 1024 },
          }),
        },
      },
      async (request, reply) => {
        assertOrigin(request, options.webOrigin);
        const token = sessionToken(request, options.secureCookie);
        const authenticated = await options.service.authenticate(token, {
          allowSecuritySetup: true,
        });
        const body = request.body as { current_password: string };
        const result = await sensitiveWrite(
          request,
          `session:${digestOpaqueToken(token)}`,
          "/me/mfa/totp/enrollment",
          "POST",
          async () => ({
            status: 201,
            body: envelope(
              await options.mfa!.startEnrollment(
                authenticated.user,
                body.current_password,
                requestIds(request),
              ),
              request,
            ),
          }),
        );
        reply.code(result.status);
        return result.body;
      },
    );
    app.post(
      "/api/v1/me/mfa/totp/confirm",
      {
        schema: {
          body: bodySchema(["code"], { code: { type: "string", minLength: 6, maxLength: 32 } }),
        },
      },
      async (request, reply) => {
        assertOrigin(request, options.webOrigin);
        const token = sessionToken(request, options.secureCookie);
        const authenticated = await options.service.authenticate(token, {
          allowSecuritySetup: true,
        });
        const body = request.body as { code: string };
        const result = await sensitiveWrite(
          request,
          `session:${digestOpaqueToken(token)}`,
          "/me/mfa/totp/confirm",
          "POST",
          async () => ({
            status: 200,
            body: envelope(
              await options.mfa!.confirmEnrollment(
                authenticated.user.id,
                body.code,
                requestIds(request),
              ),
              request,
            ),
          }),
        );
        reply.code(result.status);
        return result.body;
      },
    );
    app.post(
      "/api/v1/auth/mfa/totp/verify",
      {
        schema: {
          body: bodySchema(["code"], { code: { type: "string", minLength: 6, maxLength: 32 } }),
        },
      },
      async (request, reply) => {
        assertOrigin(request, options.webOrigin);
        const challenge = cookieValue(request, challengeCookieName(options.secureCookie));
        if (!challenge)
          throw new AuthError("mfa_challenge_invalid", 401, "重新输入邮箱和密码后重试。");
        const body = request.body as { code: string };
        let sessionTokenValue = "";
        const result = await write(
          request,
          `mfa:${digestOpaqueToken(challenge)}`,
          "/auth/mfa/totp/verify",
          "POST",
          async () => {
            const login = await options.mfa!.verifyLogin(challenge, body.code, requestIds(request));
            sessionTokenValue = login.token;
            return {
              status: 200,
              body: envelope({ user: login.user, session: login.session }, request),
            };
          },
        );
        if (result.replayed || !sessionTokenValue)
          throw new AuthError("mfa_challenge_invalid", 401, "登录已完成，请刷新页面或重新登录。");
        setSessionAndClearChallenge(
          reply,
          sessionTokenValue,
          options.secureCookie,
          options.sessionTtlMinutes,
        );
        reply.code(result.status);
        return result.body;
      },
    );
    app.delete(
      "/api/v1/me/mfa/totp",
      {
        schema: {
          body: bodySchema(["current_password", "code"], {
            current_password: { type: "string", maxLength: 1024 },
            code: { type: "string", minLength: 6, maxLength: 32 },
          }),
        },
      },
      async (request, reply) => {
        assertOrigin(request, options.webOrigin);
        const token = sessionToken(request, options.secureCookie);
        const authenticated = await options.service.authenticate(token);
        const body = request.body as { current_password: string; code: string };
        const result = await write(
          request,
          `session:${digestOpaqueToken(token)}`,
          "/me/mfa/totp",
          "DELETE",
          async () => {
            await options.mfa!.disable(
              authenticated.user,
              body.current_password,
              body.code,
              requestIds(request),
            );
            return { status: 204, body: null };
          },
        );
        clearSessionCookie(reply, options.secureCookie);
        reply.code(result.status);
        return result.body;
      },
    );
  }
}
