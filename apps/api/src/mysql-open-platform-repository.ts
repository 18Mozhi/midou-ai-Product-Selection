import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { OpenPlatformError, type OpenPlatformRepository } from "./open-platform-service.js";
const iso = (v: any) => (v ? new Date(v).toISOString() : null),
  json = (v: any) => (typeof v === "string" ? JSON.parse(v) : v);
export class MySqlOpenPlatformRepository implements OpenPlatformRepository {
  constructor(
    private readonly pool: Pool,
    private readonly now = () => new Date(),
  ) {}
  async tx(fn: (c: PoolConnection) => Promise<any>) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const r = await fn(c);
      await c.commit();
      return r;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async overview(i: any) {
    const escapeLike = (value: string) =>
        value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_"),
      page = (value: any) => ({
        limit: Number(value.pageSize),
        offset: (Number(value.page) - 1) * Number(value.pageSize),
      }),
      clientStatus =
        "CASE WHEN c.status='active' AND c.expires_at<=? THEN 'expired' ELSE c.status END",
      clientWhere = ["(? IS NULL OR c.organization_id=?)"],
      clientParams: any[] = [i.organizationId ?? null, i.organizationId ?? null],
      hookWhere = ["(? IS NULL OR w.organization_id=?)"],
      hookParams: any[] = [i.organizationId ?? null, i.organizationId ?? null],
      deliveryWhere = ["(? IS NULL OR d.organization_id=?)"],
      deliveryParams: any[] = [i.organizationId ?? null, i.organizationId ?? null];
    if (i.clients.query) {
      clientWhere.push("(c.name LIKE ? ESCAPE '\\\\' OR c.client_prefix LIKE ? ESCAPE '\\\\')");
      const value = `%${escapeLike(i.clients.query)}%`;
      clientParams.push(value, value);
    }
    if (i.clients.status !== "all") {
      clientWhere.push(`${clientStatus}=?`);
      clientParams.push(this.now(), i.clients.status);
    }
    if (i.webhooks.query) {
      hookWhere.push("(w.name LIKE ? ESCAPE '\\\\' OR w.target_url LIKE ? ESCAPE '\\\\')");
      const value = `%${escapeLike(i.webhooks.query)}%`;
      hookParams.push(value, value);
    }
    if (i.webhooks.status !== "all") {
      hookWhere.push("w.status=?");
      hookParams.push(i.webhooks.status);
    }
    if (i.deliveries.query) {
      deliveryWhere.push(
        "(e.name LIKE ? ESCAPE '\\\\' OR d.event_type LIKE ? ESCAPE '\\\\' OR d.id=?)",
      );
      const value = `%${escapeLike(i.deliveries.query)}%`;
      deliveryParams.push(value, value, i.deliveries.query);
    }
    if (i.deliveries.status !== "all") {
      deliveryWhere.push("d.status=?");
      deliveryParams.push(i.deliveries.status);
    }
    const clientSortMap: Record<string, string> = {
        updated_desc: "c.updated_at DESC",
        updated_asc: "c.updated_at ASC",
        name_asc: "c.name ASC,c.id ASC",
        name_desc: "c.name DESC,c.id DESC",
      },
      webhookSortMap: Record<string, string> = {
        updated_desc: "w.updated_at DESC",
        updated_asc: "w.updated_at ASC",
        name_asc: "w.name ASC,w.id ASC",
        name_desc: "w.name DESC,w.id DESC",
      },
      deliverySortMap: Record<string, string> = {
        updated_desc: "d.updated_at DESC",
        updated_asc: "d.updated_at ASC",
        attempts_desc: "d.attempt_count DESC,d.updated_at DESC",
      },
      clientSort = clientSortMap[String(i.clients.sort)]!,
      webhookSort = webhookSortMap[String(i.webhooks.sort)]!,
      deliverySort = deliverySortMap[String(i.deliveries.sort)]!,
      clientPage = page(i.clients),
      webhookPage = page(i.webhooks),
      deliveryPage = page(i.deliveries),
      [
        clientRowsResult,
        hookRowsResult,
        deliveryRowsResult,
        clientCountResult,
        hookCountResult,
        deliveryCountResult,
        clientSummaryResult,
        hookSummaryResult,
        deliverySummaryResult,
      ] = await Promise.all([
        this.pool.query<RowDataPacket[]>(
          `SELECT c.id,c.organization_id,c.name,c.client_prefix,c.scopes_json,c.quota_per_minute,${clientStatus} status,c.expires_at,c.last_used_at,c.version,c.updated_at FROM platform_api_clients c WHERE ${clientWhere.join(" AND ")} ORDER BY ${clientSort} LIMIT ? OFFSET ?`,
          [this.now(), ...clientParams, clientPage.limit, clientPage.offset],
        ),
        this.pool.query<RowDataPacket[]>(
          `SELECT w.id,w.organization_id,w.name,w.target_url,w.events_json,w.fingerprint,w.status,w.version,w.updated_at FROM webhook_endpoints w WHERE ${hookWhere.join(" AND ")} ORDER BY ${webhookSort} LIMIT ? OFFSET ?`,
          [...hookParams, webhookPage.limit, webhookPage.offset],
        ),
        this.pool.query<RowDataPacket[]>(
          `SELECT d.id,d.endpoint_id,e.name endpoint_name,d.organization_id,d.event_type,d.status,d.attempt_count,d.response_status,d.last_error_code,d.available_at,d.updated_at FROM webhook_deliveries d JOIN webhook_endpoints e ON e.id=d.endpoint_id WHERE ${deliveryWhere.join(" AND ")} ORDER BY ${deliverySort} LIMIT ? OFFSET ?`,
          [...deliveryParams, deliveryPage.limit, deliveryPage.offset],
        ),
        this.pool.query<RowDataPacket[]>(
          `SELECT COUNT(*) total FROM platform_api_clients c WHERE ${clientWhere.join(" AND ")}`,
          clientParams,
        ),
        this.pool.query<RowDataPacket[]>(
          `SELECT COUNT(*) total FROM webhook_endpoints w WHERE ${hookWhere.join(" AND ")}`,
          hookParams,
        ),
        this.pool.query<RowDataPacket[]>(
          `SELECT COUNT(*) total FROM webhook_deliveries d JOIN webhook_endpoints e ON e.id=d.endpoint_id WHERE ${deliveryWhere.join(" AND ")}`,
          deliveryParams,
        ),
        this.pool.query<RowDataPacket[]>(
          `SELECT COUNT(*) total,SUM(${clientStatus}='active') active,SUM(${clientStatus}='expired') expired FROM platform_api_clients c WHERE (? IS NULL OR c.organization_id=?)`,
          [this.now(), this.now(), i.organizationId ?? null, i.organizationId ?? null],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT COUNT(*) total,SUM(w.status='active') active FROM webhook_endpoints w WHERE (? IS NULL OR w.organization_id=?)",
          [i.organizationId ?? null, i.organizationId ?? null],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT COUNT(*) total,SUM(d.status='dead_letter') dead_letter,SUM(d.status='retry_scheduled') retry_scheduled FROM webhook_deliveries d WHERE (? IS NULL OR d.organization_id=?)",
          [i.organizationId ?? null, i.organizationId ?? null],
        ),
      ]),
      clients = clientRowsResult[0],
      hooks = hookRowsResult[0],
      deliveries = deliveryRowsResult[0],
      clientCount = Number(clientCountResult[0][0]?.total ?? 0),
      hookCount = Number(hookCountResult[0][0]?.total ?? 0),
      deliveryCount = Number(deliveryCountResult[0][0]?.total ?? 0),
      clientSummary: RowDataPacket = clientSummaryResult[0][0] ?? ({} as RowDataPacket),
      hookSummary: RowDataPacket = hookSummaryResult[0][0] ?? ({} as RowDataPacket),
      deliverySummary: RowDataPacket = deliverySummaryResult[0][0] ?? ({} as RowDataPacket),
      pagination = (input: any, total: number) => ({
        page: Number(input.page),
        page_size: Number(input.pageSize),
        total,
        total_pages: Math.max(1, Math.ceil(total / Number(input.pageSize))),
      });
    return {
      clients: clients.map((r) => ({
        ...r,
        scopes: json(r.scopes_json),
        scopes_json: undefined,
        expires_at: iso(r.expires_at),
        last_used_at: iso(r.last_used_at),
        updated_at: iso(r.updated_at),
      })),
      webhooks: hooks.map((r) => ({
        ...r,
        events: json(r.events_json),
        events_json: undefined,
        updated_at: iso(r.updated_at),
      })),
      deliveries: deliveries.map((r) => ({
        ...r,
        available_at: iso(r.available_at),
        updated_at: iso(r.updated_at),
      })),
      summary: {
        clients: {
          total: Number(clientSummary.total ?? 0),
          active: Number(clientSummary.active ?? 0),
          expired: Number(clientSummary.expired ?? 0),
        },
        webhooks: {
          total: Number(hookSummary.total ?? 0),
          active: Number(hookSummary.active ?? 0),
        },
        deliveries: {
          total: Number(deliverySummary.total ?? 0),
          dead_letter: Number(deliverySummary.dead_letter ?? 0),
          retry_scheduled: Number(deliverySummary.retry_scheduled ?? 0),
        },
      },
      pagination: {
        clients: pagination(i.clients, clientCount),
        webhooks: pagination(i.webhooks, hookCount),
        deliveries: pagination(i.deliveries, deliveryCount),
      },
      scope: { organization_id: i.organizationId ?? null },
      observed_at: this.now().toISOString(),
    };
  }
  async op(c: PoolConnection, i: any, resourceId: string, result: any) {
    const find = async () => {
        const [rows] = await c.query<RowDataPacket[]>(
          "SELECT result_json FROM open_platform_operations WHERE actor_id=? AND route_key=? AND " +
            "idempotency_key=? LIMIT 1 FOR UPDATE",
          [i.actorId, i.route, i.idempotencyKey],
        );
        return rows[0] ? { ...json(rows[0].result_json), idempotent_replay: true } : null;
      },
      old = await find();
    if (old) return old;
    try {
      await c.query(
        "INSERT INTO open_platform_operations(id,actor_id,route_key,idempotency_key," +
          "resource_id,result_json,created_at) VALUES(?,?,?,?,?,?,?)",
        [
          randomUUID(),
          i.actorId,
          i.route,
          i.idempotencyKey,
          resourceId,
          JSON.stringify(result),
          this.now(),
        ],
      );
      return null;
    } catch (e: any) {
      if (e?.code === "ER_DUP_ENTRY") {
        const replay = await find();
        if (replay) return replay;
      }
      throw e;
    }
  }
  async audit(
    c: PoolConnection,
    i: any,
    org: string,
    action: string,
    type: string,
    id: string,
    meta: any = {},
  ) {
    await c.query(
      "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id," +
        "action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at," +
        "schema_version) VALUES(?,?,NULL,?,?,?,?, 'succeeded',?,?,?,?,1)",
      [
        randomUUID(),
        org,
        i.actorId,
        action,
        type,
        id,
        i.requestId,
        i.traceId,
        JSON.stringify(meta),
        this.now(),
      ],
    );
    await c.query(
      "INSERT INTO outbox_events(id,organization_id,workspace_id,event_type,schema_version," +
        "payload_json,status,attempt_count,available_at,request_id,trace_id,created_at," +
        "updated_at,version) VALUES(?,?,NULL,?,1,?,'pending',0,?,?,?,?,?,1)",
      [
        randomUUID(),
        org,
        `${action}.v1`,
        JSON.stringify({ resource_type: type, resource_id: id, ...meta }),
        this.now(),
        i.requestId,
        i.traceId,
        this.now(),
        this.now(),
      ],
    );
  }
  async createClient(i: any) {
    return this.tx(async (c) => {
      const replay = await this.op(c, i, i.id, { id: i.id });
      if (replay) return replay;
      await c.query(
        "INSERT INTO platform_api_clients(id,organization_id,name,client_prefix,secret_hash," +
          "scopes_json,quota_per_minute,status,expires_at,last_used_at,rotated_from_id," +
          "version,created_by,revoked_by,revoked_at,created_at,updated_at) VALUES(?," +
          "?,?,?,?,?,?,'active',?,NULL,NULL,1,?,NULL,NULL,?,?)",
        [
          i.id,
          i.value.organization_id,
          i.value.name,
          i.value.client_prefix,
          i.value.secret_hash,
          JSON.stringify(i.value.scopes),
          i.value.quota_per_minute,
          i.value.expires_at,
          i.actorId,
          this.now(),
          this.now(),
        ],
      );
      await this.audit(
        c,
        i,
        i.value.organization_id,
        "platform.open.client.created",
        "platform_api_client",
        i.id,
        { scopes: i.value.scopes, quota: i.value.quota_per_minute, reason: i.value.reason },
      );
      const result = { id: i.id, secret: i.value.secret, secret_visible_once: true, version: 1 };
      await c.query(
        "UPDATE open_platform_operations SET result_json=? WHERE actor_id=? AND route_key=? AND idempotency_key=?",
        [
          JSON.stringify({ id: i.id, secret_visible_once: false }),
          i.actorId,
          i.route,
          i.idempotencyKey,
        ],
      );
      return result;
    });
  }
  async clientAction(i: any) {
    return this.tx(async (c) => {
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM platform_api_clients WHERE id=? FOR UPDATE",
        [i.clientId],
      );
      const row = rows[0];
      if (!row) throw new OpenPlatformError("client_not_found", 404, "刷新列表后重试。");
      const replay = await this.op(c, i, i.clientId, {
        id: i.clientId,
        status: row.status,
        version: row.version,
      });
      if (replay) return replay;
      if (Number(i.value.expected_version) !== Number(row.version))
        throw new OpenPlatformError("client_version_conflict", 409, "刷新后重试。");
      if (i.value.action === "revoke") {
        await c.query(
          "UPDATE platform_api_clients SET status='revoked',revoked_by=?,revoked_at=?,version=version+1,updated_at=? WHERE id=?",
          [i.actorId, this.now(), this.now(), i.clientId],
        );
        await this.audit(
          c,
          i,
          row.organization_id,
          "platform.open.client.revoked",
          "platform_api_client",
          i.clientId,
          { reason: i.value.reason },
        );
        return { id: i.clientId, status: "revoked", version: Number(row.version) + 1 };
      }
      const next = randomUUID();
      await c.query(
        "UPDATE platform_api_clients SET status='rotated',revoked_by=?,revoked_at=?,version=version+1,updated_at=? WHERE id=?",
        [i.actorId, this.now(), this.now(), i.clientId],
      );
      await c.query(
        "INSERT INTO platform_api_clients(id,organization_id,name,client_prefix,secret_hash," +
          "scopes_json,quota_per_minute,status,expires_at,last_used_at,rotated_from_id," +
          "version,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'active'," +
          "?,NULL,?,1,?,?,?)",
        [
          next,
          row.organization_id,
          row.name,
          i.value.client_prefix,
          i.value.secret_hash,
          JSON.stringify(json(row.scopes_json)),
          row.quota_per_minute,
          i.value.expires_at,
          i.clientId,
          i.actorId,
          this.now(),
          this.now(),
        ],
      );
      await this.audit(
        c,
        i,
        row.organization_id,
        "platform.open.client.rotated",
        "platform_api_client",
        i.clientId,
        { replacement_id: next, reason: i.value.reason },
      );
      await c.query(
        "UPDATE open_platform_operations SET resource_id=?,result_json=? WHERE actor_id=? AND route_key=? AND idempotency_key=?",
        [
          next,
          JSON.stringify({ id: next, secret_visible_once: false }),
          i.actorId,
          i.route,
          i.idempotencyKey,
        ],
      );
      return { id: next, secret: i.value.secret, secret_visible_once: true, version: 1 };
    });
  }
  async createWebhook(i: any) {
    return this.tx(async (c) => {
      const replay = await this.op(c, i, i.id, { id: i.id });
      if (replay) return replay;
      await c.query(
        "INSERT INTO webhook_endpoints(id,organization_id,name,target_url,events_json," +
          "secret_ciphertext,secret_nonce,secret_auth_tag,key_version,fingerprint,status," +
          "version,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?," +
          "?,?,?,?,'active',1,?,?,?,?)",
        [
          i.id,
          i.value.organization_id,
          i.value.name,
          i.value.target_url,
          JSON.stringify(i.value.events),
          i.value.ciphertext,
          i.value.nonce,
          i.value.authTag,
          i.value.key_version,
          i.value.fingerprint,
          i.actorId,
          i.actorId,
          this.now(),
          this.now(),
        ],
      );
      await this.audit(
        c,
        i,
        i.value.organization_id,
        "platform.open.webhook.created",
        "webhook_endpoint",
        i.id,
        { target_url: i.value.target_url, events: i.value.events, reason: i.value.reason },
      );
      await c.query(
        "UPDATE open_platform_operations SET result_json=? WHERE actor_id=? AND route_key=? AND idempotency_key=?",
        [
          JSON.stringify({ id: i.id, secret_visible_once: false }),
          i.actorId,
          i.route,
          i.idempotencyKey,
        ],
      );
      return { id: i.id, secret: i.value.secret, secret_visible_once: true, version: 1 };
    });
  }
  async updateWebhook(i: any) {
    return this.tx(async (c) => {
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT organization_id,version FROM webhook_endpoints WHERE id=? FOR UPDATE",
        [i.endpointId],
      );
      const row = rows[0];
      if (!row) throw new OpenPlatformError("webhook_not_found", 404, "刷新后重试。");
      const replay = await this.op(c, i, i.endpointId, { id: i.endpointId, version: row.version });
      if (replay) return replay;
      if (Number(i.value.expected_version) !== Number(row.version))
        throw new OpenPlatformError("webhook_version_conflict", 409, "刷新后重试。");
      await c.query(
        "UPDATE webhook_endpoints SET name=?,target_url=?,events_json=?,status=?," +
          "version=version+1,updated_by=?,updated_at=? WHERE id=?",
        [
          i.value.name,
          i.value.target_url,
          JSON.stringify(i.value.events),
          i.value.status,
          i.actorId,
          this.now(),
          i.endpointId,
        ],
      );
      await this.audit(
        c,
        i,
        row.organization_id,
        "platform.open.webhook.updated",
        "webhook_endpoint",
        i.endpointId,
        { status: i.value.status, reason: i.value.reason },
      );
      return { id: i.endpointId, status: i.value.status, version: Number(row.version) + 1 };
    });
  }
  async rotateWebhook(i: any) {
    return this.tx(async (c) => {
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT organization_id,version FROM webhook_endpoints WHERE id=? FOR UPDATE",
        [i.endpointId],
      );
      const row = rows[0];
      if (!row) throw new OpenPlatformError("webhook_not_found", 404, "刷新后重试。");
      const replay = await this.op(c, i, i.endpointId, { id: i.endpointId, version: row.version });
      if (replay) return replay;
      if (Number(i.value.expected_version) !== Number(row.version))
        throw new OpenPlatformError("webhook_version_conflict", 409, "刷新后重试。");
      await c.query(
        "UPDATE webhook_endpoints SET secret_ciphertext=?,secret_nonce=?,secret_auth_tag=?," +
          "key_version=?,fingerprint=?,version=version+1,updated_by=?,updated_at=? WHERE id=?",
        [
          i.value.ciphertext,
          i.value.nonce,
          i.value.authTag,
          i.value.key_version,
          i.value.fingerprint,
          i.actorId,
          this.now(),
          i.endpointId,
        ],
      );
      await this.audit(
        c,
        i,
        row.organization_id,
        "platform.open.webhook.secret_rotated",
        "webhook_endpoint",
        i.endpointId,
        { reason: i.value.reason },
      );
      await c.query(
        "UPDATE open_platform_operations SET result_json=? WHERE actor_id=? AND route_key=? AND idempotency_key=?",
        [
          JSON.stringify({
            id: i.endpointId,
            secret_visible_once: false,
            version: Number(row.version) + 1,
          }),
          i.actorId,
          i.route,
          i.idempotencyKey,
        ],
      );
      return {
        id: i.endpointId,
        secret: i.value.secret,
        secret_visible_once: true,
        version: Number(row.version) + 1,
      };
    });
  }
  async enqueue(i: any) {
    return this.tx(async (c) => {
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT organization_id,status FROM webhook_endpoints WHERE id=? FOR UPDATE",
        [i.endpointId],
      );
      const row = rows[0];
      if (!row) throw new OpenPlatformError("webhook_not_found", 404, "刷新后重试。");
      if (row.status !== "active")
        throw new OpenPlatformError("webhook_disabled", 409, "先启用 Webhook。");
      const replay = await this.op(c, i, i.id, { id: i.id, status: "queued" });
      if (replay) return replay;
      const payload = {
        id: i.eventId,
        type: "scoutops.test",
        occurred_at: this.now().toISOString(),
        data: { message: "ScoutOps webhook connectivity test" },
      };
      await c.query(
        "INSERT INTO webhook_deliveries(id,endpoint_id,organization_id,event_id,event_type," +
          "payload_json,status,attempt_count,available_at,request_id,trace_id,created_at," +
          "updated_at) VALUES(?,?,?,?,?,?,'queued',0,?,?,?,?,?)",
        [
          i.id,
          i.endpointId,
          row.organization_id,
          i.eventId,
          "scoutops.test",
          JSON.stringify(payload),
          this.now(),
          i.requestId,
          i.traceId,
          this.now(),
          this.now(),
        ],
      );
      await c.query(
        "INSERT INTO webhook_delivery_events(id,delivery_id,endpoint_id,organization_id," +
          "from_status,to_status,attempt_count,reason,actor_id,request_id,trace_id," +
          "occurred_at) VALUES(?,?,?,?,NULL,'queued',0,?,?,?,?,?)",
        [
          randomUUID(),
          i.id,
          i.endpointId,
          row.organization_id,
          i.value.reason,
          i.actorId,
          i.requestId,
          i.traceId,
          this.now(),
        ],
      );
      await this.audit(
        c,
        i,
        row.organization_id,
        "platform.open.webhook.test_enqueued",
        "webhook_delivery",
        i.id,
        { reason: i.value.reason },
      );
      return { id: i.id, status: "queued" };
    });
  }
  async replay(i: any) {
    return this.tx(async (c) => {
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM webhook_deliveries WHERE id=? FOR UPDATE",
        [i.deliveryId],
      );
      const row = rows[0];
      if (!row) throw new OpenPlatformError("delivery_not_found", 404, "刷新后重试。");
      if (!["dead_letter", "succeeded"].includes(row.status))
        throw new OpenPlatformError("delivery_not_replayable", 409, "仅可重放成功或死信记录。");
      const next = randomUUID(),
        event = randomUUID(),
        replay = await this.op(c, i, next, { id: next, status: "queued" });
      if (replay) return replay;
      await c.query(
        "INSERT INTO webhook_deliveries(id,endpoint_id,organization_id,event_id,event_type," +
          "payload_json,status,attempt_count,available_at,request_id,trace_id,created_at," +
          "updated_at) VALUES(?,?,?,?,?,?,'queued',0,?,?,?,?,?)",
        [
          next,
          row.endpoint_id,
          row.organization_id,
          event,
          row.event_type,
          JSON.stringify(json(row.payload_json)),
          this.now(),
          i.requestId,
          i.traceId,
          this.now(),
          this.now(),
        ],
      );
      await c.query(
        "INSERT INTO webhook_delivery_events(id,delivery_id,endpoint_id,organization_id," +
          "from_status,to_status,attempt_count,reason,actor_id,request_id,trace_id," +
          "occurred_at) VALUES(?,?,?,?,NULL,'queued',0,?,?,?,?,?)",
        [
          randomUUID(),
          next,
          row.endpoint_id,
          row.organization_id,
          `replay:${i.value.reason}`,
          i.actorId,
          i.requestId,
          i.traceId,
          this.now(),
        ],
      );
      await this.audit(
        c,
        i,
        row.organization_id,
        "platform.open.delivery.replayed",
        "webhook_delivery",
        next,
        { source_delivery_id: i.deliveryId, reason: i.value.reason },
      );
      return { id: next, status: "queued", source_delivery_id: i.deliveryId };
    });
  }
  async authenticate(i: any) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      await c.query("DELETE FROM open_api_request_nonces WHERE expires_at<=?", [i.now]);
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT id,organization_id,scopes_json,quota_per_minute,status,expires_at FROM platform_api_clients " +
          "WHERE secret_hash=? LIMIT 1 FOR UPDATE",
        [i.secretHash],
      );
      const row = rows[0];
      if (!row || row.status !== "active" || new Date(row.expires_at) <= i.now)
        throw new OpenPlatformError("open_api_unauthorized", 401, "检查 API Client 密钥。");
      const scopes = json(row.scopes_json),
        usage = async (outcome: string, status: number) =>
          c.query(
            "INSERT INTO open_api_usage(id,client_id,organization_id,route_key,outcome," +
              "status_code,request_id,trace_id,occurred_at) VALUES(?,?,?,'GET:/open/v1/status'," +
              "?,?,?,?,?)",
            [
              randomUUID(),
              row.id,
              row.organization_id,
              outcome,
              status,
              i.requestId,
              i.traceId,
              i.now,
            ],
          ),
        blocked = async (error: OpenPlatformError) => {
          await usage("blocked", error.statusCode);
          await c.commit();
          throw error;
        };
      if (!scopes.includes(i.requiredScope))
        return blocked(
          new OpenPlatformError("open_api_scope_denied", 403, "为 API Client 授予所需 scope。"),
        );
      const [[count]] = await c.query<RowDataPacket[]>(
        "SELECT COUNT(*) count FROM open_api_usage WHERE client_id=? AND occurred_at>=DATE_SUB(?,INTERVAL 1 MINUTE)",
        [row.id, i.now],
      );
      if (!count)
        return blocked(
          new OpenPlatformError("open_api_usage_row_invalid", 500, "检查 MySQL 后重试。"),
        );
      if (Number(count.count) >= Number(row.quota_per_minute))
        return blocked(
          new OpenPlatformError("open_api_quota_exceeded", 429, "等待配额窗口恢复后重试。"),
        );
      try {
        await c.query(
          "INSERT INTO open_api_request_nonces(client_id,nonce,request_timestamp,expires_at) VALUES(?,?,?,?)",
          [row.id, i.nonce, i.timestamp, i.nonceExpiresAt],
        );
      } catch (e: any) {
        if (e?.code === "ER_DUP_ENTRY")
          return blocked(
            new OpenPlatformError("open_api_replay_detected", 409, "为本次请求生成新的 nonce。"),
          );
        throw e;
      }
      await usage("succeeded", 200);
      await c.query("UPDATE platform_api_clients SET last_used_at=?,updated_at=? WHERE id=?", [
        i.now,
        i.now,
        row.id,
      ]);
      await c.commit();
      return {
        client_id: row.id,
        organization_id: row.organization_id,
        scopes,
        quota_per_minute: Number(row.quota_per_minute),
      };
    } catch (e) {
      try {
        await c.rollback();
      } catch (rollbackError) {
        void rollbackError;
      }
      throw e;
    } finally {
      c.release();
    }
  }
  async recordRejectedAuth(i: any) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT id,organization_id,quota_per_minute FROM platform_api_clients WHERE secret_hash=? " +
          "AND status='active' AND expires_at>? LIMIT 1 FOR UPDATE",
        [i.secretHash, i.now],
      );
      const row = rows[0];
      if (!row) {
        await c.commit();
        return false;
      }
      const [[count]] = await c.query<RowDataPacket[]>(
        "SELECT COUNT(*) count FROM open_api_usage WHERE client_id=? AND occurred_at>=DATE_SUB(?,INTERVAL 1 MINUTE)",
        [row.id, i.now],
      );
      if (!count)
        throw new OpenPlatformError("open_api_usage_row_invalid", 500, "检查 MySQL 后重试。");
      if (Number(count.count) >= Number(row.quota_per_minute)) {
        await c.commit();
        return true;
      }
      await c.query(
        "INSERT INTO open_api_usage(id,client_id,organization_id,route_key,outcome," +
          "status_code,request_id,trace_id,occurred_at) VALUES(?,?,?,'GET:/open/v1/status'," +
          "'blocked',?,?,?,?)",
        [randomUUID(), row.id, row.organization_id, i.statusCode, i.requestId, i.traceId, i.now],
      );
      await c.commit();
      return false;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async recordUsage(i: any) {
    await this.pool.query(
      "INSERT INTO open_api_usage(id,client_id,organization_id,route_key,outcome," +
        "status_code,request_id,trace_id,occurred_at) VALUES(?,?,?,?,?,?,?,?,?)",
      [
        i.id,
        i.clientId,
        i.organizationId,
        i.routeKey,
        i.outcome,
        i.statusCode,
        i.requestId,
        i.traceId,
        i.occurredAt,
      ],
    );
  }
}
