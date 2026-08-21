import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError } from "./api-foundation.js";
import { parseLastEventId, type RealtimeService } from "./realtime-service.js";
export interface RealtimeRouteOptions {
  service: RealtimeService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
  pollMs: number;
  heartbeatMs: number;
  maxConnectionSeconds: number;
  maxConnections: number;
}
const ids = (r: FastifyRequest) => ({
    requestId: String(r.headers["x-request-id"]),
    traceId: String(r.headers["x-trace-id"]),
  }),
  encode = (item: any) =>
    `id: ${item.id}\nevent: ${item.event_type}\ndata: ${JSON.stringify(item)}\n\n`;
export function registerRealtimeRoutes(app: FastifyInstance, o: RealtimeRouteOptions) {
  let active = 0;
  app.get("/api/v1/realtime/events", async (r, reply) => {
    if (r.headers.origin && r.headers.origin !== o.webOrigin)
      throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重连。");
    if (active >= o.maxConnections)
      throw new ApiError(
        503,
        "realtime_capacity_reached",
        "实时连接暂时繁忙。",
        "稍后自动重连或刷新页面。",
      );
    const a = await o.auth.authenticate(sessionToken(r, o.secureCookie)),
      x = await o.authorization.resolveSession(a.user.id, a.session.id);
    await o.authorization.authorize({
      actorId: a.user.id,
      organizationId: x.context.organization_id,
      workspaceId: x.context.workspace_id,
      capability: "notification:read",
      surface: "api",
      ...ids(r),
    });
    let cursor = parseLastEventId(r.headers["last-event-id"] ?? (r.query as any)?.last_event_id);
    const context = {
      organizationId: x.context.organization_id,
      workspaceId: x.context.workspace_id,
      actorId: a.user.id,
      ...ids(r),
    };
    const initial = await o.service.replay({ ...context, afterId: cursor });
    await o.service.auditConnect({ ...context, afterId: cursor });
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    });
    reply.raw.write("retry: 3000\n\n");
    for (const item of initial) {
      reply.raw.write(encode(item));
      cursor = item.id;
    }
    active++;
    let polling = false,
      closed = false;
    let poll: ReturnType<typeof setInterval>;
    const close = () => {
      if (closed) return;
      closed = true;
      active--;
      clearInterval(poll);
      clearInterval(heartbeat);
      clearTimeout(expiry);
      if (!reply.raw.destroyed) reply.raw.end();
    };
    const pollOnce = async () => {
      if (closed || polling) return;
      polling = true;
      try {
        const items = await o.service.replay({ ...context, afterId: cursor });
        for (const item of items) {
          reply.raw.write(encode(item));
          cursor = item.id;
        }
      } catch {
        reply.raw.write('event: stream_error\ndata: {"action_hint":"refresh_and_reconnect"}\n\n');
        close();
      } finally {
        polling = false;
      }
    };
    poll = setInterval(() => void pollOnce(), o.pollMs);
    const heartbeat = setInterval(() => {
      if (!closed) reply.raw.write(`: heartbeat ${Date.now()}\n\n`);
    }, o.heartbeatMs);
    const expiry = setTimeout(close, o.maxConnectionSeconds * 1000);
    r.raw.once("close", close);
    return reply;
  });
}
