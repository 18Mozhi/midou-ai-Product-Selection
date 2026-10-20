import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import {
  BrowserHandoffStore,
  handoffIdValid,
  validHandoffCommand,
} from "@scoutops/playwright-crawler";
import type { AuditEvent } from "@scoutops/audit";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import { sessionToken } from "./auth-routes.js";
import type { Pool } from "mysql2/promise";

export async function browserHandoffRunLive(
  pool: Pick<Pool, "query">,
  runId: string,
  now = new Date(),
) {
  // Match the Date parameter serialization used by the lease producer/reaper.
  const [rows] = await pool.query(
    "SELECT r.id FROM crawler_browser_runs r JOIN crawler_profile_leases l ON l.run_id=r.id WHERE r.id=? AND r.status='running' AND l.expires_at>? LIMIT 1",
    [runId, now],
  );
  return Array.isArray(rows) && rows.length > 0;
}

export interface BrowserHandoffRouteOptions {
  auth: LocalAuthService;
  authorization: AuthorizationService;
  secureCookie: boolean;
  webOrigin: string;
  root: string;
  isLive: (runId: string) => Promise<boolean>;
  audit: (event: AuditEvent) => Promise<void>;
}
export function registerBrowserHandoffRoutes(app: FastifyInstance, o: BrowserHandoffRouteOptions) {
  const store = new BrowserHandoffStore(o.root),
    base = "/api/v1/platform/crawler-handoffs";
  const cleanup = setInterval(() => {
    void store.cleanup().catch(() => {});
  }, 60_000);
  cleanup.unref();
  app.addHook("onClose", async () => {
    clearInterval(cleanup);
  });
  const ids = (r: FastifyRequest) => ({
    request_id: String(r.headers["x-request-id"]),
    trace_id: String(r.headers["x-trace-id"]),
  });
  const actor = async (r: FastifyRequest, write = false) => {
    if (write && r.headers.origin !== o.webOrigin)
      throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从采集运行监控重试。");
    const a = await o.auth.authenticate(sessionToken(r, o.secureCookie));
    await o.authorization.authorize({
      actorId: a.user.id,
      capability: "platform:superadmin",
      surface: "api",
      requestId: ids(r).request_id,
      traceId: ids(r).trace_id,
    });
    return { actorId: a.user.id, session: createHash("sha256").update(a.session.id).digest("hex") };
  };
  const active = async (id: string) => {
    try {
      const info = await store.info(id);
      if (!(await o.isLive(info.run_id))) throw new Error("not_live");
      return info;
    } catch {
      throw new ApiError(
        410,
        "crawler_handoff_expired",
        "采集接管会话已结束。",
        "刷新待处理验证码列表。",
      );
    }
  };
  const claim = async (id: string, a: Awaited<ReturnType<typeof actor>>) => {
    const value = JSON.parse(
      await readFile(store.path(id, "claim.json"), "utf8").catch(() => "null"),
    );
    if (!value || value.actorId !== a.actorId || value.session !== a.session)
      throw new ApiError(
        409,
        "crawler_handoff_not_owned",
        "请先接管此会话。",
        "同一会话只允许一个管理员操作。",
      );
  };
  const audit = (
    r: FastifyRequest,
    actorId: string,
    id: string,
    action: string,
    metadata: Record<string, unknown>,
  ) =>
    o.audit({
      id: randomUUID(),
      organization_id: null,
      workspace_id: null,
      actor_id: actorId,
      action,
      resource_type: "crawler_handoff",
      resource_id: id,
      outcome: "succeeded",
      ...ids(r),
      metadata,
      occurred_at: new Date(),
      schema_version: 1,
    });
  app.get(base, async (r, reply) => {
    await actor(r);
    reply.header("cache-control", "private, no-store");
    const items = await store.list(),
      live = await Promise.all(
        items.map(async (item) => ((await o.isLive(item.run_id)) ? item : null)),
      );
    return { data: { items: live.filter(Boolean) }, ...ids(r) };
  });
  app.post(base + "/:id/claim", async (r, reply) => {
    const a = await actor(r, true),
      id = (r.params as { id: string }).id;
    requireIdempotencyKey(r);
    const info = await active(id);
    try {
      await writeFile(store.path(id, "claim.json"), JSON.stringify(a), { flag: "wx", mode: 0o600 });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    await claim(id, a);
    await audit(r, a.actorId, id, "crawler_handoff.claim", { run_id: info.run_id });
    reply.header("cache-control", "private, no-store");
    return { data: info, ...ids(r) };
  });
  app.get(base + "/:id/frame", async (r, reply) => {
    const a = await actor(r),
      id = (r.params as { id: string }).id;
    await active(id);
    await claim(id, a);
    reply
      .header("cache-control", "private, no-store")
      .header("x-content-type-options", "nosniff")
      .type("image/jpeg");
    return store.frame(id);
  });
  app.post(base + "/:id/commands", async (r) => {
    const a = await actor(r, true),
      id = (r.params as { id: string }).id,
      commandId = requireIdempotencyKey(r);
    await active(id);
    await claim(id, a);
    if (!handoffIdValid(commandId) || !validHandoffCommand(r.body))
      throw new ApiError(
        400,
        "crawler_handoff_command_invalid",
        "接管操作无效。",
        "使用页面提供的验证码操作。",
      );
    // Audit kind only: never store CAPTCHA text, keystrokes, screenshot or credentials.
    await audit(r, a.actorId, id, "crawler_handoff.command", {
      kind: r.body.kind,
      command_id: commandId,
    });
    try {
      await store.command(id, r.body, commandId);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST")
        throw new ApiError(
          409,
          "crawler_handoff_busy",
          "上一个操作正在执行。",
          "等待画面更新后重试。",
        );
      throw e;
    }
    return { data: { accepted: true }, ...ids(r) };
  });
}
