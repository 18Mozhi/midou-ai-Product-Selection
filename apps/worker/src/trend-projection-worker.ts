import { createHash, randomUUID } from "node:crypto";
import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { BUILTIN_PROVIDER_SOURCES } from "@scoutops/provider-sources";

export type TrendProjectionResult =
  | { status: "idle" }
  | {
      status:
        | "succeeded"
        | "succeeded_empty"
        | "failed_terminal"
        | "scheduled"
        | "dead_letter";
      job_id: string;
      topic_id?: string;
      error_code?: string;
      diagnostic?: string;
    };
interface ClaimedJob {
  id: string;
  organizationId: string;
  workspaceId: string;
  normalizedRecordId: string;
  providerId: string;
  providerCode: string;
  rawEvidenceId: string;
  collectionTaskId: string;
  payload: Record<string, unknown>;
  actorId: string;
  requestId: string;
  traceId: string;
  attemptCount: number;
}

const automaticTrendLocales = {
  us: { market: "US", language: "en-US" },
  gb: { market: "GB", language: "en-GB" },
  de: { market: "DE", language: "de-DE" },
  fr: { market: "FR", language: "fr-FR" },
  jp: { market: "JP", language: "ja-JP" },
  kr: { market: "KR", language: "ko-KR" },
  sg: { market: "SG", language: "en-SG" },
  au: { market: "AU", language: "en-AU" },
} as const;
const automaticTrendTopics = new Set([
  "consumer_trends",
  "viral_products",
  "amazon",
  "tiktok_shop",
  "etsy",
  "ebay",
  "retail_data",
  "search_data",
  "social_buzz",
  "reddit",
  "youtube",
  "new_products",
]);
const automaticProductTopics = new Set([
  "viral_products",
  "amazon",
  "tiktok_shop",
  "etsy",
  "ebay",
  "new_products",
]);
const automaticSources = new Map(
  BUILTIN_PROVIDER_SOURCES.filter(
    (source) =>
      source.availability === "automatic" &&
      source.category !== "product_supply",
  ).map((source) => [source.code, source]),
);

export type ProjectedTrendProviderContext =
  | { accepted: false }
  | { accepted: true; automatic: boolean; market: string; language: string };

export function projectedTrendProviderContext(
  providerCode: string,
): ProjectedTrendProviderContext {
  if (providerCode === "google_news_search")
    return {
      accepted: true,
      automatic: false,
      market: "US",
      language: "en-US",
    };
  const source = automaticSources.get(providerCode);
  if (source) {
    const market =
        source.markets.find((value) => value !== "GLOBAL") ??
        source.markets[0] ??
        "GLOBAL",
      language = source.languages[0] ?? "multi";
    return { accepted: true, automatic: true, market, language };
  }
  const match = /^gnews_([a-z]{2})_(.+)$/.exec(providerCode),
    locale = match
      ? automaticTrendLocales[
          match[1] as keyof typeof automaticTrendLocales
        ]
      : null;
  if (!match || !locale || !automaticTrendTopics.has(match[2]!))
    return { accepted: false };
  return { accepted: true, automatic: true, ...locale };
}

export function isAutomaticProductDiscoveryProvider(providerCode: string) {
  const context = projectedTrendProviderContext(providerCode);
  const match = /^gnews_[a-z]{2}_(.+)$/.exec(providerCode),
    source = automaticSources.get(providerCode);
  return (
    context.accepted &&
    context.automatic &&
    (source?.category === "ecommerce" ||
      Boolean(match && automaticProductTopics.has(match[1]!)))
  );
}

export function isConcreteProductEvidence(
  payload: Record<string, unknown>,
  canonicalUrl: string,
) {
  const urlLooksLikeProduct = [
    /\/(?:dp|gp\/product)\/[A-Z0-9]{10}(?:[/?]|$)/i,
    /\/itm\//i,
    /\/ip\//i,
    /\.made-in-china\.com\/product\//i,
    /\/product\/[^/]+/i,
  ].some((pattern) => pattern.test(canonicalUrl));
  const price = payload.price == null ? null : Number(payload.price);
  return (
    urlLooksLikeProduct ||
    (Number.isFinite(price) && price! >= 0 && typeof payload.image_url === "string")
  );
}

export function normalizeProjectedTrendTitle(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.length > 1000)
    throw new TrendProjectionError("trend_title_invalid", false);
  return value
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ");
}

export class TrendProjectionError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "TrendProjectionError";
  }
}

const text = (value: unknown, code: string, maximum: number) => {
  if (typeof value !== "string" || !value.trim() || value.length > maximum)
    throw new TrendProjectionError(code, false);
  return value.trim();
};
const date = (value: unknown, code: string) => {
  const result = new Date(text(value, code, 120));
  if (!Number.isFinite(result.getTime()))
    throw new TrendProjectionError(code, false);
  return result;
};
const http = (value: unknown) => {
  const raw = text(value, "trend_url_invalid", 2048);
  let result: URL;
  try {
    result = new URL(raw);
  } catch {
    throw new TrendProjectionError("trend_url_invalid", false);
  }
  if (
    !["http:", "https:"].includes(result.protocol) ||
    result.username ||
    result.password ||
    result.hash
  )
    throw new TrendProjectionError("trend_url_invalid", false);
  return result.toString();
};

export class MySqlTrendProjectionWorker {
  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly leaseSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async processOnce(): Promise<TrendProjectionResult> {
    await this.enqueueMissingAutomaticDownstream();
    await this.enqueueMissing();
    const job = await this.claim();
    if (!job) return { status: "idle" };
    if (!projectedTrendProviderContext(job.providerCode).accepted) {
      await this.finish(job, "succeeded_empty", null);
      return { status: "succeeded_empty", job_id: job.id };
    }
    try {
      const topicId = await this.project(job);
      return { status: "succeeded", job_id: job.id, topic_id: topicId };
    } catch (error) {
      const dependencyCode =
        typeof (error as { code?: unknown })?.code === "string"
          ? `trend_projection_${(error as { code: string }).code.toLocaleLowerCase("en-US")}`
          : "trend_projection_dependency_failed";
      const failure =
        error instanceof TrendProjectionError
          ? error
          : new TrendProjectionError(dependencyCode, true);
      const status = !failure.retryable
        ? "failed_terminal"
        : job.attemptCount >= 4
          ? "dead_letter"
          : "scheduled";
      await this.finish(job, status, failure.code);
      return {
        status,
        job_id: job.id,
        error_code: failure.code,
        ...(process.env.NODE_ENV === "production"
          ? {}
          : {
              diagnostic:
                error instanceof Error
                  ? error.message.slice(0, 300)
                  : "unknown",
            }),
      };
    }
  }

  private async enqueueMissing() {
    const now = this.now();
    await this.pool.query(
      "INSERT IGNORE INTO trend_projection_jobs (id,organization_id,workspace_id,normalized_record_id,status,attempt_count,available_at,lease_owner,lease_expires_at,last_error_code,request_id,trace_id,created_at,updated_at) SELECT UUID(),n.organization_id,n.workspace_id,n.id,'scheduled',0,?,NULL,NULL,NULL,n.request_id,n.trace_id,?,? FROM normalized_records n JOIN providers p ON p.id=n.provider_id LEFT JOIN trend_projection_jobs j ON j.normalized_record_id=n.id WHERE n.status='active' AND j.id IS NULL AND p.code NOT IN ('amazon_product','made_in_china_search') ORDER BY n.created_at LIMIT 100",
      [now, now, now],
    );
  }

  private async enqueueMissingAutomaticDownstream() {
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const providers = await this.downstreamProviders(c),
        [rows] = await c.query<RowDataPacket[]>(
          `SELECT o.id opportunity_id,o.organization_id,o.workspace_id,o.name,o.market,o.created_by,
                  c.id competitor_id,c.external_id,c.product_url,c.latest_snapshot_id,
                  se.resource_id search_id,
                  (c.latest_snapshot_id IS NULL AND NOT EXISTS (
                    SELECT 1 FROM collection_subqueries q
                    WHERE JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='competitor_snapshot'
                      AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.competitor_id'))=CONVERT(c.id USING utf8mb4) COLLATE utf8mb4_bin
                      AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.page_url')) IS NOT NULL
                  )) competitor_task_missing,
                  (se.resource_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM collection_subqueries q
                    WHERE JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='sourcing_search'
                      AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.search_id'))=CONVERT(se.resource_id USING utf8mb4) COLLATE utf8mb4_bin
                      AND CHAR_LENGTH(JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.query'))) BETWEEN 1 AND 300
                  )) sourcing_task_missing
           FROM opportunities o
           JOIN competitors c
             ON c.opportunity_id=o.id
            AND c.organization_id=o.organization_id
            AND c.workspace_id=o.workspace_id
            AND c.deleted_at IS NULL
           LEFT JOIN sourcing_events se
             ON se.organization_id=o.organization_id
            AND se.workspace_id=o.workspace_id
            AND se.event_type='sourcing.search.seeded_from_opportunity'
            AND JSON_UNQUOTE(JSON_EXTRACT(se.payload_json,'$.opportunity_id'))=CONVERT(o.id USING utf8mb4) COLLATE utf8mb4_bin
           WHERE o.source_type='trend_topic'
             AND o.lifecycle_status<>'deleted'
             AND (
               (c.latest_snapshot_id IS NULL AND NOT EXISTS (
                 SELECT 1 FROM collection_subqueries q
                 WHERE JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='competitor_snapshot'
                   AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.competitor_id'))=CONVERT(c.id USING utf8mb4) COLLATE utf8mb4_bin
                   AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.page_url')) IS NOT NULL
               ))
               OR
               (se.resource_id IS NOT NULL AND NOT EXISTS (
                 SELECT 1 FROM collection_subqueries q
                 WHERE JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='sourcing_search'
                   AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.search_id'))=CONVERT(se.resource_id USING utf8mb4) COLLATE utf8mb4_bin
                   AND CHAR_LENGTH(JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.query'))) BETWEEN 1 AND 300
               ))
             )
           ORDER BY o.created_at,o.id
           LIMIT 20 FOR UPDATE`,
        );
      for (const row of rows) {
        const context = {
          organizationId: String(row.organization_id),
          workspaceId: String(row.workspace_id),
          actorId: String(row.created_by),
          requestId: `auto-downstream-${randomUUID()}`,
          traceId: `auto-downstream-${String(row.opportunity_id)}`,
        };
        if (
          providers.amazon &&
          Boolean(row.competitor_task_missing) &&
          !row.latest_snapshot_id &&
          row.product_url &&
          row.external_id
        ) {
          await this.scheduleCoreCollection(
            c,
            context,
            randomUUID(),
            [
              {
                providerId: providers.amazon,
                required: true,
                target: {
                  page_url: String(row.product_url),
                  asin: String(row.external_id),
                  projection_type: "competitor_snapshot",
                  competitor_id: String(row.competitor_id),
                },
              },
            ],
            "competitor.collection.auto_scheduled",
            now,
          );
        }
        const searchId = row.search_id == null ? null : String(row.search_id),
          supplierProviderIds = [providers.madeInChina, providers.ec21].filter(
            (value): value is string => Boolean(value),
          );
        if (
          searchId &&
          Boolean(row.sourcing_task_missing) &&
          supplierProviderIds.length
        ) {
          const taskId = randomUUID();
          await this.scheduleCoreCollection(
            c,
            context,
            taskId,
            supplierProviderIds.map((providerId) => ({
              providerId,
              required: false,
              target: {
                query: String(row.name).slice(0, 300),
                projection_type: "sourcing_search",
                search_id: searchId,
              },
            })),
            "sourcing.collection.auto_scheduled",
            now,
          );
          await c.query(
            "UPDATE sourcing_searches SET collection_task_id=?,input_ref=?,status='queued',candidate_count=0,missing_fields_json='[]',updated_at=? WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL",
            [
              taskId,
              row.opportunity_id,
              now,
              searchId,
              context.organizationId,
              context.workspaceId,
            ],
          );
        }
      }
      await c.commit();
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }

  private async downstreamProviders(c: PoolConnection) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT id,code FROM providers WHERE code IN ('amazon_product','made_in_china_search','ec21_supplier_search') AND status='enabled' AND access_mode='public_page'",
    );
    const values = new Map(rows.map((row) => [String(row.code), String(row.id)]));
    return {
      amazon: values.get("amazon_product") ?? null,
      madeInChina: values.get("made_in_china_search") ?? null,
      ec21: values.get("ec21_supplier_search") ?? null,
    };
  }

  private async scheduleCoreCollection(
    c: PoolConnection,
    context: {
      organizationId: string;
      workspaceId: string;
      actorId: string;
      requestId: string;
      traceId: string;
    },
    taskId: string,
    subqueries: Array<{
      providerId: string;
      required: boolean;
      target: Record<string, unknown>;
    }>,
    eventType: string,
    now: Date,
  ) {
    if (!subqueries.length) return;
    await c.query(
      "INSERT INTO collection_tasks(id,organization_id,workspace_id,status,coverage_status,priority,scheduled_at,available_at,attempt_count,successful_subquery_count,failed_subquery_count,blocked_subquery_count,available_result_count,missing_fields_json,request_id,trace_id,version,created_by,created_at,updated_at) VALUES(?,?,?,'scheduled',NULL,'high',?,?,0,0,0,0,0,'[]',?,?,1,?,?,?)",
      [
        taskId,
        context.organizationId,
        context.workspaceId,
        now,
        now,
        context.requestId,
        context.traceId,
        context.actorId,
        now,
        now,
      ],
    );
    for (let index = 0; index < subqueries.length; index += 1) {
      const subquery = subqueries[index]!;
      await c.query(
        "INSERT INTO collection_subqueries(id,task_id,organization_id,workspace_id,provider_id,ordinal,target_json,is_required,status,available_result_count,missing_fields_json,error_code,retryable,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'pending',0,'[]',NULL,0,1,?,?)",
        [
          randomUUID(),
          taskId,
          context.organizationId,
          context.workspaceId,
          subquery.providerId,
          index + 1,
          JSON.stringify(subquery.target),
          subquery.required ? 1 : 0,
          now,
          now,
        ],
      );
    }
    await c.query(
      "INSERT INTO collection_task_events(id,task_id,organization_id,workspace_id,event_type,from_status,to_status,actor_type,actor_id,request_id,trace_id,metadata_json,occurred_at) VALUES(?,?,?,?,?,NULL,'scheduled','worker',?,?,?,?,?)",
      [
        randomUUID(),
        taskId,
        context.organizationId,
        context.workspaceId,
        eventType,
        this.workerId,
        context.requestId,
        context.traceId,
        JSON.stringify({
          automatic: true,
          source: "automatic_product_discovery",
          subquery_count: subqueries.length,
        }),
        now,
      ],
    );
  }

  private async claim(): Promise<ClaimedJob | null> {
    const c = await this.pool.getConnection(),
      now = this.now(),
      expires = new Date(now.getTime() + this.leaseSeconds * 1000);
    try {
      await c.beginTransaction();
      const [jobs] = await c.query<RowDataPacket[]>(
        "SELECT * FROM trend_projection_jobs WHERE (status='scheduled' AND available_at<=?) OR (status='leased' AND lease_expires_at<=?) ORDER BY available_at,id LIMIT 1 FOR UPDATE",
        [now, now],
      );
      if (!jobs[0]) {
        await c.commit();
        return null;
      }
      const row = jobs[0];
      await c.query(
        "UPDATE trend_projection_jobs SET status='leased',attempt_count=attempt_count+1,lease_owner=?,lease_expires_at=?,updated_at=? WHERE id=?",
        [this.workerId, expires, now, row.id],
      );
      const [records] = await c.query<RowDataPacket[]>(
        "SELECT n.organization_id,n.workspace_id,n.provider_id,n.raw_evidence_id,n.payload_json,n.created_by,n.request_id,n.trace_id,p.code provider_code,e.collection_task_id FROM normalized_records n JOIN providers p ON p.id=n.provider_id JOIN raw_evidence e ON e.id=n.raw_evidence_id WHERE n.id=? AND n.organization_id=? AND n.workspace_id=? LIMIT 1",
        [row.normalized_record_id, row.organization_id, row.workspace_id],
      );
      if (!records[0])
        throw new TrendProjectionError(
          "trend_projection_record_missing",
          false,
        );
      const record = records[0];
      await c.commit();
      return {
        id: String(row.id),
        organizationId: String(row.organization_id),
        workspaceId: String(row.workspace_id),
        normalizedRecordId: String(row.normalized_record_id),
        providerId: String(record.provider_id),
        providerCode: String(record.provider_code),
        rawEvidenceId: String(record.raw_evidence_id),
        collectionTaskId: String(record.collection_task_id),
        payload:
          typeof record.payload_json === "string"
            ? JSON.parse(record.payload_json)
            : record.payload_json,
        actorId: String(record.created_by),
        requestId: String(record.request_id),
        traceId: String(record.trace_id),
        attemptCount: Number(row.attempt_count) + 1,
      };
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }

  private async project(job: ClaimedJob) {
    const title = text(job.payload.title, "trend_title_invalid", 1000),
      normalizedTitle = normalizeProjectedTrendTitle(title),
      publisher = text(job.payload.publisher, "trend_publisher_invalid", 300),
      canonicalUrl = http(job.payload.canonical_url),
      publishedAt = date(
        job.payload.published_at ?? job.payload.observed_at,
        "trend_published_at_invalid",
      ),
      observedAt = date(job.payload.observed_at, "trend_observed_at_invalid");
    const providerContext = projectedTrendProviderContext(job.providerCode);
    if (!providerContext.accepted)
      throw new TrendProjectionError("trend_provider_unsupported", false);
    const topicKey = createHash("sha256")
        .update(
          `${providerContext.market}\0${providerContext.language}\0${normalizedTitle}`,
        )
        .digest("hex"),
      now = this.now(),
      c = await this.pool.getConnection();
    let stage = "begin";
    try {
      await c.beginTransaction();
      stage = "topic_lookup";
      const [topics] = await c.query<RowDataPacket[]>(
        "SELECT id FROM trend_topics WHERE organization_id=? AND workspace_id=? AND topic_key=? FOR UPDATE",
        [job.organizationId, job.workspaceId, topicKey],
      );
      const topicId = topics[0] ? String(topics[0].id) : randomUUID();
      if (!topics[0]) {
        stage = "topic_insert";
        await c.query(
          "INSERT INTO trend_topics (id,organization_id,workspace_id,topic_key,title,category,market,language,status,signal_count,source_count,heat_value,heat_unit,momentum_percent,confidence_score,confidence_status,first_seen_at,last_seen_at,source_fresh_at,version,created_by,created_at,updated_at) VALUES (?,?,?,?,?,NULL,?,?,'active',0,0,0,'signals',NULL,NULL,'insufficient_data',?,?,?,1,?,?,?)",
          [
            topicId,
            job.organizationId,
            job.workspaceId,
            topicKey,
            title,
            providerContext.market,
            providerContext.language,
            publishedAt,
            publishedAt,
            observedAt,
            job.actorId,
            now,
            now,
          ],
        );
      }
      stage = "signal_insert";
      const signalId = randomUUID();
      const [insert] = await c.query<ResultSetHeader>(
        "INSERT IGNORE INTO trend_signals (id,organization_id,workspace_id,topic_id,normalized_record_id,raw_evidence_id,provider_id,title,publisher,canonical_url,published_at,observed_at,request_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          signalId,
          job.organizationId,
          job.workspaceId,
          topicId,
          job.normalizedRecordId,
          job.rawEvidenceId,
          job.providerId,
          title,
          publisher,
          canonicalUrl,
          publishedAt,
          observedAt,
          job.requestId,
          job.traceId,
          now,
        ],
      );
      if (insert.affectedRows) {
        stage = "topic_aggregate";
        await c.query(
          "UPDATE trend_topics t SET signal_count=(SELECT COUNT(*) FROM trend_signals s WHERE s.topic_id=t.id),source_count=(SELECT COUNT(DISTINCT provider_id) FROM trend_signals s WHERE s.topic_id=t.id),heat_value=(SELECT COUNT(*) FROM trend_signals s WHERE s.topic_id=t.id),first_seen_at=(SELECT MIN(published_at) FROM trend_signals s WHERE s.topic_id=t.id),last_seen_at=(SELECT MAX(published_at) FROM trend_signals s WHERE s.topic_id=t.id),source_fresh_at=GREATEST(source_fresh_at,?),version=version+1,updated_at=? WHERE t.id=?",
          [observedAt, now, topicId],
        );
        stage = "keyword_insert";
        await c.query(
          "INSERT IGNORE INTO trend_topic_keywords (id,organization_id,workspace_id,topic_id,keyword,keyword_type,language,market,created_at) VALUES (?,?,?,?,?,'primary',?,?,?)",
          [
            randomUUID(),
            job.organizationId,
            job.workspaceId,
            topicId,
            normalizedTitle.slice(0, 300),
            providerContext.language,
            providerContext.market,
            now,
          ],
        );
        stage = "monitoring_rules";
        const matchedRule = await this.evaluateMonitoringRules(
          c,
          job,
          topicId,
          normalizedTitle,
          providerContext.market,
          providerContext.language,
          now,
        );
        stage = "event_insert";
        await this.event(
          c,
          job,
          "trend.topic.projected",
          "trend_topic",
          topicId,
          {
            normalized_record_id: job.normalizedRecordId,
            provider_code: job.providerCode,
            market: providerContext.market,
            language: providerContext.language,
            heat_unit: "signals",
          },
        );
        if (
          (isAutomaticProductDiscoveryProvider(job.providerCode) &&
            isConcreteProductEvidence(job.payload, canonicalUrl)) ||
          matchedRule
        ) {
          stage = "automatic_product_discovery";
          await this.discoverOpportunity(
            c,
            job,
            topicId,
            signalId,
            title,
            providerContext.market,
            observedAt,
            now,
          );
        }
      }
      stage = "job_complete";
      await c.query(
        "UPDATE trend_projection_jobs SET status='succeeded',lease_owner=NULL,lease_expires_at=NULL,last_error_code=NULL,updated_at=? WHERE id=? AND status='leased' AND lease_owner=?",
        [now, job.id, this.workerId],
      );
      await c.commit();
      return topicId;
    } catch (error) {
      await c.rollback();
      if (error instanceof TrendProjectionError) throw error;
      const wrapped = new Error(
        `${stage}: ${error instanceof Error ? error.message : "unknown"}`,
      ) as Error & { code?: string };
      const code = (error as { code?: string })?.code;
      if (code) wrapped.code = code;
      throw wrapped;
    } finally {
      c.release();
    }
  }

  private async discoverOpportunity(
    c: PoolConnection,
    job: ClaimedJob,
    topicId: string,
    signalId: string,
    title: string,
    market: string,
    observedAt: Date,
    now: Date,
  ) {
    const opportunityId = randomUUID();
    const [insert] = await c.query<ResultSetHeader>(
      "INSERT IGNORE INTO opportunities (id,organization_id,workspace_id,name,market,category,source_type,source_ref_id,owner_id,lifecycle_status,recommendation_status,overall_score,trend_score,competition_score,profit_status,risk_level,confidence_status,confidence_score,evidence_count,source_count,coverage_status,score_rule_version,scored_at,decision_status,version,created_by,created_at,updated_at) VALUES (?,?,?,?,?,NULL,'trend_topic',?,NULL,'ready','insufficient_data',NULL,NULL,NULL,'insufficient_data','unknown','insufficient_data',NULL,0,0,'partial',NULL,NULL,'pending',1,?,?,?)",
      [
        opportunityId,
        job.organizationId,
        job.workspaceId,
        title.slice(0, 200),
        market,
        topicId,
        job.actorId,
        now,
        now,
      ],
    );
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT id FROM opportunities WHERE organization_id=? AND workspace_id=? AND source_type='trend_topic' AND source_ref_id=? LIMIT 1 FOR UPDATE",
      [job.organizationId, job.workspaceId, topicId],
    );
    const persistedOpportunityId = String(rows[0]?.id ?? opportunityId);
    await c.query(
      "INSERT IGNORE INTO opportunity_evidence_links (id,organization_id,workspace_id,opportunity_id,evidence_type,evidence_id,provider_id,raw_evidence_id,observed_at,created_at) VALUES (?,?,?,?,'trend_signal',?,?,?,?,?)",
      [
        randomUUID(),
        job.organizationId,
        job.workspaceId,
        persistedOpportunityId,
        signalId,
        job.providerId,
        job.rawEvidenceId,
        observedAt,
        now,
      ],
    );
    await c.query(
      "UPDATE opportunities o SET evidence_count=(SELECT COUNT(*) FROM opportunity_evidence_links l WHERE l.opportunity_id=o.id),source_count=(SELECT COUNT(DISTINCT provider_id) FROM opportunity_evidence_links l WHERE l.opportunity_id=o.id),coverage_status='partial',lifecycle_status=IF(lifecycle_status='candidate','ready',lifecycle_status),version=IF(?,version,version+1),updated_at=? WHERE o.id=?",
      [insert.affectedRows, now, persistedOpportunityId],
    );
    if (insert.affectedRows) {
      await this.opportunityEvent(
        c,
        job,
        persistedOpportunityId,
        {
          source_type: "trend_topic",
          source_ref_id: topicId,
          provider_code: job.providerCode,
          recommendation_status: "insufficient_data",
          discovery_mode: "automatic",
        },
        now,
      );
      await this.createDownstreamDiscovery(
        c,
        job,
        persistedOpportunityId,
        title,
        market,
        now,
      );
    }
  }

  private async evaluateMonitoringRules(
    c: PoolConnection,
    job: ClaimedJob,
    topicId: string,
    title: string,
    market: string,
    language: string,
    now: Date,
  ) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT id,include_keywords_json,negative_keywords_json,market,language,category,created_by FROM trend_monitoring_rules WHERE organization_id=? AND workspace_id=? AND status='enabled' FOR UPDATE",
      [job.organizationId, job.workspaceId],
    );
    let matchedAny = false;
    for (const row of rows) {
      const include =
          typeof row.include_keywords_json === "string"
            ? JSON.parse(row.include_keywords_json)
            : row.include_keywords_json,
        negative =
          typeof row.negative_keywords_json === "string"
            ? JSON.parse(row.negative_keywords_json)
            : row.negative_keywords_json;
      const matched =
        Array.isArray(include) &&
        include.some((keyword: unknown) =>
          title.includes(
            String(keyword).normalize("NFKC").toLocaleLowerCase("en-US"),
          ),
        ) &&
        !(Array.isArray(negative) ? negative : []).some((keyword: unknown) =>
          title.includes(
            String(keyword).normalize("NFKC").toLocaleLowerCase("en-US"),
          ),
        ) &&
        (!row.market || String(row.market).toUpperCase() === market) &&
        (!row.language || String(row.language) === language) &&
        !row.category;
      if (matched) {
        matchedAny = true;
        await c.query(
          "INSERT IGNORE INTO trend_topic_follows (id,organization_id,workspace_id,topic_id,user_id,created_at) VALUES (?,?,?,?,?,?)",
          [
            randomUUID(),
            job.organizationId,
            job.workspaceId,
            topicId,
            row.created_by,
            now,
          ],
        );
        await this.event(
          c,
          job,
          "trend.monitoring_rule.matched",
          "trend_topic",
          topicId,
          { rule_id: String(row.id), market, language },
        );
      }
    }
    if (rows.length)
      await c.query(
        "UPDATE trend_monitoring_rules SET last_evaluated_at=?,updated_at=updated_at WHERE organization_id=? AND workspace_id=? AND status='enabled'",
        [now, job.organizationId, job.workspaceId],
      );
    return matchedAny;
  }

  private async createDownstreamDiscovery(
    c: PoolConnection,
    job: ClaimedJob,
    opportunityId: string,
    title: string,
    market: string,
    now: Date,
  ) {
    const canonicalUrl = text(
        job.payload.canonical_url,
        "trend_url_invalid",
        2048,
      ),
      asin = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i.exec(
        canonicalUrl,
      )?.[1]?.toUpperCase();
    let competitorId: string | null = null;
    if (asin) {
      const proposedCompetitorId = randomUUID();
      await c.query(
        "INSERT IGNORE INTO competitors (id,organization_id,workspace_id,opportunity_id,provider_id,market,source_site,external_id,product_url,title,status,latest_snapshot_id,revision,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,'Amazon',?,?,?,'active',NULL,1,?,?,?)",
        [
          proposedCompetitorId,
          job.organizationId,
          job.workspaceId,
          opportunityId,
          job.providerId,
          market,
          asin,
          canonicalUrl,
          title.slice(0, 500),
          job.actorId,
          now,
          now,
        ],
      );
      const [competitors] = await c.query<RowDataPacket[]>(
        "SELECT id FROM competitors WHERE organization_id=? AND workspace_id=? AND market=? AND source_site='Amazon' AND external_id=? AND deleted_at IS NULL LIMIT 1 FOR UPDATE",
        [job.organizationId, job.workspaceId, market, asin],
      );
      competitorId = String(competitors[0]?.id ?? proposedCompetitorId);
    }
    const searchId = randomUUID();
    await c.query(
      "INSERT INTO sourcing_searches (id,organization_id,workspace_id,collection_task_id,input_type,input_ref,status,candidate_count,missing_fields_json,request_id,trace_id,created_by,created_at,updated_at) VALUES (?,?,?,?,'opportunity',?,'queued',0,'[]',?,?,?,?,?)",
      [
        searchId,
        job.organizationId,
        job.workspaceId,
        null,
        opportunityId,
        job.requestId,
        job.traceId,
        job.actorId,
        now,
        now,
      ],
    );
    const providers = await this.downstreamProviders(c);
    if (competitorId && asin && providers.amazon) {
      await this.scheduleCoreCollection(
        c,
        {
          organizationId: job.organizationId,
          workspaceId: job.workspaceId,
          actorId: job.actorId,
          requestId: job.requestId,
          traceId: job.traceId,
        },
        randomUUID(),
        [
          {
            providerId: providers.amazon,
            required: true,
            target: {
              page_url: canonicalUrl,
              asin,
              projection_type: "competitor_snapshot",
              competitor_id: competitorId,
            },
          },
        ],
        "competitor.collection.auto_scheduled",
        now,
      );
    }
    const supplierProviderIds = [providers.madeInChina, providers.ec21].filter(
      (value): value is string => Boolean(value),
    );
    if (supplierProviderIds.length) {
      const supplierTaskId = randomUUID();
      await this.scheduleCoreCollection(
        c,
        {
          organizationId: job.organizationId,
          workspaceId: job.workspaceId,
          actorId: job.actorId,
          requestId: job.requestId,
          traceId: job.traceId,
        },
        supplierTaskId,
        supplierProviderIds.map((providerId) => ({
          providerId,
          required: false,
          target: {
            query: title.slice(0, 300),
            projection_type: "sourcing_search",
            search_id: searchId,
          },
        })),
        "sourcing.collection.auto_scheduled",
        now,
      );
      await c.query(
        "UPDATE sourcing_searches SET collection_task_id=? WHERE id=?",
        [supplierTaskId, searchId],
      );
    } else {
      await c.query(
        "UPDATE sourcing_searches SET status='succeeded_empty',missing_fields_json=?,updated_at=? WHERE id=?",
        [JSON.stringify(["supplier_crawler"]), now, searchId],
      );
    }
    await c.query(
      "INSERT INTO sourcing_events (id,organization_id,workspace_id,event_type,resource_id,actor_id,payload_json,request_id,trace_id,created_at) VALUES (?,?,?,'sourcing.search.seeded_from_opportunity',?,'ai-selection-worker',?,?,?,?)",
      [
        randomUUID(),
        job.organizationId,
        job.workspaceId,
        searchId,
        JSON.stringify({ opportunity_id: opportunityId, candidate_count: 0 }),
        job.requestId,
        job.traceId,
        now,
      ],
    );
  }

  private async opportunityEvent(
    c: PoolConnection,
    job: ClaimedJob,
    opportunityId: string,
    payload: unknown,
    now: Date,
  ) {
    await c.query(
      "INSERT INTO opportunity_events (id,organization_id,workspace_id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) VALUES (?,?,?,'opportunity.candidate.discovered','opportunity',?,'worker',?,?,?,?,?)",
      [
        randomUUID(),
        job.organizationId,
        job.workspaceId,
        opportunityId,
        this.workerId,
        job.requestId,
        job.traceId,
        JSON.stringify(payload),
        now,
      ],
    );
    await c.query(
      "INSERT INTO opportunity_outbox (id,organization_id,workspace_id,event_type,resource_type,resource_id,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES (?,?,?,'opportunity.candidate.discovered','opportunity',?,?,'queued',0,?,?,?,?,?)",
      [
        randomUUID(),
        job.organizationId,
        job.workspaceId,
        opportunityId,
        JSON.stringify(payload),
        now,
        job.requestId,
        job.traceId,
        now,
        now,
      ],
    );
  }

  private async finish(
    job: ClaimedJob,
    status: "succeeded_empty" | "failed_terminal" | "scheduled" | "dead_letter",
    errorCode: string | null,
  ) {
    const now = this.now(),
      retryDelays = [60_000, 300_000, 900_000] as const,
      available =
        status === "scheduled"
          ? new Date(
              now.getTime() + retryDelays[Math.min(job.attemptCount - 1, 2)]!,
            )
          : now;
    await this.pool.query(
      "UPDATE trend_projection_jobs SET status=?,available_at=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=?,updated_at=? WHERE id=? AND lease_owner=?",
      [status, available, errorCode, now, job.id, this.workerId],
    );
  }

  private async event(
    c: PoolConnection,
    job: ClaimedJob,
    eventType: string,
    resourceType: string,
    resourceId: string,
    payload: unknown,
  ) {
    const now = this.now(),
      eventId = randomUUID();
    await c.query(
      "INSERT INTO trend_events (id,organization_id,workspace_id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) VALUES (?,?,?,?,?,?,'worker',?,?,?,?,?)",
      [
        eventId,
        job.organizationId,
        job.workspaceId,
        eventType,
        resourceType,
        resourceId,
        this.workerId,
        job.requestId,
        job.traceId,
        JSON.stringify(payload),
        now,
      ],
    );
    await c.query(
      "INSERT INTO trend_outbox (id,organization_id,workspace_id,event_type,resource_type,resource_id,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'queued',0,?,?,?,?,?)",
      [
        eventId,
        job.organizationId,
        job.workspaceId,
        eventType,
        resourceType,
        resourceId,
        JSON.stringify(payload),
        now,
        job.requestId,
        job.traceId,
        now,
        now,
      ],
    );
  }
}
