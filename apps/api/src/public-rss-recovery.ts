import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { BUILTIN_PROVIDER_SOURCES } from "@scoutops/provider-sources";
import type { ProviderProbeContext, ProviderAdapterService } from "./provider-adapter-service.js";
import type { CrawlerSchedulerRepository } from "./crawler-scheduler-repository.js";

const codes = BUILTIN_PROVIDER_SOURCES.filter(
  (source) =>
    source.availability === "automatic" &&
    ["syndication-feed-v1", "google-trends-rss-v1"].includes(source.parser_version),
).map((source) => source.code);

export const publicRssRecoveryCandidatesSql =
  "SELECT p.id,p.version,c.opened_at FROM providers p " +
  "JOIN users recovery_actor ON recovery_actor.id=? AND recovery_actor.status='active' " +
  "JOIN provider_runtime_circuits c ON c.provider_id=p.id AND c.state='open' " +
  "LEFT JOIN provider_adapter_health h ON h.provider_id=p.id " +
  "WHERE p.status='enabled' AND p.access_mode='public_rss' AND p.terms_review_status='approved' " +
  "AND CHAR_LENGTH(p.terms_version)>0 AND (p.terms_permanent=1 OR p.terms_expires_at>?) " +
  "AND p.parser_version IN ('syndication-feed-v1','google-trends-rss-v1') " +
  `AND p.code IN (${codes.map(() => "?").join(",")}) ` +
  "AND c.last_error_code IN ('network_error','timeout','rate_limited') AND c.opened_at<=? " +
  "AND (h.last_checked_at IS NULL OR h.last_checked_at<=?) " +
  "AND COALESCE(h.health_status='blocked' AND h.last_checked_at>=c.opened_at,0)=0 " +
  "ORDER BY COALESCE(h.last_checked_at,c.opened_at),p.id LIMIT 1";

type Options = {
  enabled: boolean;
  actorId: string;
  pollMs: number;
  cooldownMs: number;
};
type Result = { status: string; provider_id?: string };
export type PublicSourceRecoveryTarget = {
  candidatesSql: string;
  parameters: (actorId: string, now: Date, cooledAt: Date) => unknown[];
  taskContext: boolean;
  idempotencyPrefix: string;
  captchaHandoffRecovery?: true;
};

/** One bounded probe in the existing API process; no additional production service. */
export class PublicRssRecovery {
  private timer: ReturnType<typeof setInterval> | undefined;
  private active: Promise<Result> | undefined;
  private lastObservationKey: string | undefined;
  private stopping = false;
  constructor(
    private readonly pool: Pool,
    private readonly health: Pick<ProviderAdapterService, "probe">,
    private readonly recovery: Pick<CrawlerSchedulerRepository, "recoverProvider">,
    private readonly options: Options,
    private readonly now: () => Date = () => new Date(),
    private readonly onError: (code: string) => void = () => {},
    private readonly onObservation: (result: Result) => void = () => {},
    private readonly target?: PublicSourceRecoveryTarget,
  ) {}

  processOnce(): Promise<Result> {
    if (!this.options.enabled || !this.options.actorId || this.stopping)
      return Promise.resolve({ status: "disabled" });
    if (this.active) return Promise.resolve({ status: "busy" });
    const operation = this.run().then((result) => {
      const key = `${result.status}:${result.provider_id ?? ""}`;
      if (key !== this.lastObservationKey) {
        this.lastObservationKey = key;
        this.onObservation(result);
      }
      return result;
    });
    this.active = operation;
    void operation
      .finally(() => {
        if (this.active === operation) this.active = undefined;
      })
      .catch(() => {});
    return operation;
  }

  start() {
    if (this.timer || !this.options.enabled || !this.options.actorId) return;
    this.stopping = false;
    this.timer = setInterval(() => {
      void this.processOnce().catch((error: unknown) => {
        const code = (error as { code?: unknown })?.code;
        this.onError(
          typeof code === "string" && /^[A-Za-z0-9_:-]{1,120}$/.test(code)
            ? code
            : "public_rss_recovery_failed",
        );
      });
    }, this.options.pollMs);
    this.timer.unref();
  }

  async stop() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.active?.catch(() => {});
  }

  private async run(): Promise<Result> {
    const now = this.now();
    const cooledAt = new Date(now.getTime() - this.options.cooldownMs);
    const [rows] = await this.pool.query<RowDataPacket[]>(
      this.target?.candidatesSql ?? publicRssRecoveryCandidatesSql,
      this.target
        ? this.target.parameters(this.options.actorId, now, cooledAt)
        : [this.options.actorId, now, ...codes, cooledAt, cooledAt],
    );
    const candidate = rows[0];
    if (!candidate) return { status: "idle" };
    const providerId = String(candidate.id),
      requestId = randomUUID();
    const context: ProviderProbeContext = {
      actorId: this.options.actorId,
      requestId,
      traceId: requestId,
      idempotencyKey: `${this.target?.idempotencyPrefix ?? "public-rss-recovery"}:${requestId}`,
      ...(this.target?.taskContext
        ? { automaticCollectionTaskId: String(candidate.collection_task_id) }
        : {}),
    };
    const checked = new Date(candidate.recovery_checked_at).getTime(),
      updated = new Date(candidate.recovery_provider_updated_at).getTime(),
      opened = new Date(candidate.opened_at).getTime();
    // Only a fresh, actual provider health result can finish an administrator's
    // completed handoff. Historical business/browser caches never qualify.
    const verified =
      this.target?.captchaHandoffRecovery &&
      candidate.recovery_health_status === "ready" &&
      Number.isFinite(checked) &&
      Number.isFinite(updated) &&
      checked > opened &&
      checked >= updated &&
      checked >= cooledAt.getTime() &&
      checked <= now.getTime();
    const health = verified
      ? { health_status: "ready" }
      : await this.health.probe(providerId, context);
    if (health.health_status !== "ready")
      return { status: health.health_status, provider_id: providerId };
    const result = await this.recovery.recoverProvider({
      ...context,
      providerId,
      now: this.now(),
      automaticRecovery: {
        providerVersion: Number(candidate.version),
        openedAt: new Date(candidate.opened_at),
        ...(this.target?.captchaHandoffRecovery ? { captchaHandoff: true as const } : {}),
      },
    });
    return { status: result.recovered ? "recovered" : "unchanged", provider_id: providerId };
  }
}
