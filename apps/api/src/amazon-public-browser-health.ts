import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { RuntimeConfig } from "@scoutops/config";
import { COLLECTION_CLAIM_PAUSE_FILE } from "@scoutops/database";
import { PlaywrightCrawlerEngine, runWithEncryptedProfile } from "@scoutops/playwright-crawler";
import { join } from "node:path";
import {
  ProviderAdapterFailure,
  type AdapterHealthSignal,
  type ProviderRawRecord,
} from "@scoutops/provider-adapters";
import {
  anonymousAmazonFingerprint,
  createAmazonBrowserExecutionRequest,
  parseAmazonBrowserRunResult,
  assertPublicCollectionPolicy,
} from "@scoutops/provider-sources";
import { MySqlCredentialAssetRepository } from "./mysql-credential-asset-repository.js";
import { MySqlCrawlerRuntimeRepository } from "./mysql-crawler-runtime-repository.js";
import {
  CrawlerRuntimeError,
  CrawlerRuntimeService,
  type CrawlerAcquireScope,
} from "./crawler-runtime-service.js";
import type { AdapterProviderRecord, ProviderProbeContext } from "./provider-adapter-service.js";

// Exact existing BaoTa Python runtime and project helper, not caller-controlled executables.
export const AMAZON_HEALTH_PYTHON_TRANSPORT = Object.freeze({
  executable: "/www/server/pyporject_evn/versions/3.12.13/bin/python3.12",
  script: "/www/wwwroot/ai选品/python/scoutops_crawler/public_http.py",
});

type HealthTransport = "browser" | "python";
export async function verifyAmazonHealthTransportParity(
  collect: (
    target: Record<string, unknown>,
    transport: HealthTransport,
  ) => Promise<ProviderRawRecord[]>,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const browser = await collect({ query: "storage box" }, "browser");
  signal.throwIfAborted();
  if (!browser.length) throw new ProviderAdapterFailure("invalid_payload", false);
  const python = await collect({ query: "storage box" }, "python");
  signal.throwIfAborted();
  const pythonIds = new Set(python.map((record) => record.externalId));
  const shared = browser.find((record) => pythonIds.has(record.externalId));
  if (!shared) throw new ProviderAdapterFailure("invalid_payload", false);
  for (const transport of ["browser", "python"] as const) {
    signal.throwIfAborted();
    const [detail] = await collect(
      { page_url: "https://www.amazon.com/dp/" + shared.externalId },
      transport,
    );
    signal.throwIfAborted();
    if (!detail || detail.externalId !== shared.externalId)
      throw new ProviderAdapterFailure("invalid_payload", false);
  }
}

export class AmazonPublicBrowserHealth {
  constructor(
    private readonly pool: Pool,
    private readonly config: RuntimeConfig,
    private readonly fetcher: typeof fetch,
    private readonly resolveScope: (context: ProviderProbeContext) => Promise<CrawlerAcquireScope>,
  ) {}
  async probe(
    provider: AdapterProviderRecord,
    context: ProviderProbeContext,
  ): Promise<AdapterHealthSignal> {
    const started = Date.now(),
      controller = new AbortController(),
      timer = setTimeout(
        () => controller.abort(new Error("timeout")),
        this.config.playwright.runTimeoutSeconds * 1000,
      );
    try {
      const scope = await this.resolveScope(context);
      const [rows] = await this.pool.query<RowDataPacket[]>(
        "SELECT p.*,a.fingerprint,a.status asset_status,a.kind FROM crawler_profiles p JOIN credential_assets a ON a.id=p.credential_asset_id WHERE p.id=? AND p.provider_id=? AND p.status='active' AND a.status='active' AND ((a.kind='cookie_bundle' AND a.provider_id=p.provider_id) OR (a.kind='browser_profile' AND a.fingerprint=?))",
        [
          this.config.providerAdapters.amazonBrowserProfileId,
          provider.id,
          anonymousAmazonFingerprint(),
        ],
      );
      const profile = rows[0];
      if (!profile) throw new ProviderAdapterFailure("anonymous_profile_unavailable", false);
      const [terms] = await this.pool.query<RowDataPacket[]>(
        "SELECT terms_review_status,terms_version,terms_permanent,terms_expires_at FROM providers WHERE id=?",
        [provider.id],
      );
      const t = terms[0];
      if (
        !t ||
        t.terms_review_status !== "approved" ||
        !t.terms_version ||
        (!Number(t.terms_permanent) && !(new Date(t.terms_expires_at).getTime() > Date.now()))
      )
        throw new ProviderAdapterFailure("permission_denied", false);
      const runtime = new CrawlerRuntimeService(
        new MySqlCrawlerRuntimeRepository(
          this.pool,
          "",
          context.automaticCollectionTaskId
            ? ""
            : this.config.providerAdapters.amazonBrowserProfileId,
          this.config.nodeEnv === "production" ? COLLECTION_CLAIM_PAUSE_FILE : undefined,
          scope.accountId
            ? {
                actorId: scope.automaticTaskId
                  ? this.config.automaticSources.systemActorId
                  : context.actorId,
                profileId: this.config.providerAdapters.amazonBrowserProfileId,
                ...(scope.automaticTaskId ? {} : { manual: true as const }),
              }
            : undefined,
        ),
      );
      const record = await new MySqlCredentialAssetRepository(this.pool).getCipherRecord(
        String(profile.credential_asset_id),
      );
      const collect = async (target: Record<string, unknown>, transport: HealthTransport) => {
        const request = createAmazonBrowserExecutionRequest(
          target,
          this.config.providerAdapters.amazonPublicDeliveryPostalCode,
        );
        if (profile.kind === "cookie_bundle") {
          Object.assign(request.plan.amazon_delivery, { session_mode: "administrator_cookie" });
        }
        controller.signal.throwIfAborted();
        await assertPublicCollectionPolicy({
          providerTargetUrl: provider.targetUrl,
          target,
          fetcher: this.fetcher,
          timeoutMs: provider.timeoutMs,
        });
        controller.signal.throwIfAborted();
        const lease = await runtime.acquire({
          actorId: context.actorId,
          requestId: context.requestId,
          traceId: context.traceId,
          idempotencyKey: randomUUID(),
          ...scope,
          profileId: String(profile.id),
          leaseOwner: "amazon-public-health",
          leaseSeconds: Math.min(600, Math.max(30, this.config.playwright.runTimeoutSeconds)),
        });
        if (!lease.lease_token) throw new ProviderAdapterFailure("dependency_unavailable", true);
        let result: Awaited<ReturnType<PlaywrightCrawlerEngine["run"]>> | undefined;
        let parseFailure: ProviderAdapterFailure | undefined;
        try {
          const limits = {
            ...this.config.playwright,
            navigationTimeoutMs: this.config.providerAdapters.amazonBrowserNavigationTimeoutMs,
          };
          result = await runWithEncryptedProfile(
            new PlaywrightCrawlerEngine(limits),
            record,
            this.config.security.credentialsMasterKey,
            this.config.storage.credentialTempRoot,
            {
              maxArchiveBytes: limits.maxArchiveBytes,
              maxExtractedBytes: limits.maxExtractedBytes,
              maxFiles: limits.maxArchiveFiles,
            },
            request.plan,
            context,
            {
              locale: String(profile.locale),
              timezoneId: String(profile.timezone),
              signal: controller.signal,
              navigationTransport: this.config.providerAdapters.amazonBrowserNavigationTransport,
              ...(transport === "python"
                ? { publicHttpRuntime: AMAZON_HEALTH_PYTHON_TRANSPORT }
                : {}),
              handoff: {
                root: join(this.config.storage.runtimeTempRoot, "browser-handoffs"),
                runId: lease.run.id,
              },
              ...(this.config.providerAdapters.proxy
                ? {
                    proxy: {
                      server: this.config.providerAdapters.proxy.url,
                      username: this.config.providerAdapters.proxy.username,
                      password: this.config.providerAdapters.proxy.password,
                      connectTimeoutMs: this.config.providerAdapters.proxy.connectTimeoutMs,
                    },
                  }
                : {}),
            },
          );
          controller.signal.throwIfAborted();
          try {
            return parseAmazonBrowserRunResult(
              result as unknown as Record<string, unknown>,
              target,
            );
          } catch (error) {
            if (error instanceof ProviderAdapterFailure) parseFailure = error;
            throw error;
          }
        } finally {
          const status = result?.status,
            statusValue =
              parseFailure || controller.signal.aborted
                ? controller.signal.aborted
                  ? "timed_out"
                  : "failed"
                : status === "succeeded"
                  ? "succeeded"
                  : status === "succeeded_empty"
                    ? "succeeded_empty"
                    : status === "timeout"
                      ? "timed_out"
                      : status?.startsWith("blocked_") || status === "rate_limited"
                        ? "blocked"
                        : "failed";
          await runtime.finish({
            ...context,
            runId: lease.run.id,
            profileId: String(profile.id),
            leaseToken: lease.lease_token,
            status: statusValue,
            pageCount: result?.page_count ?? 0,
            itemCount: result?.item_count ?? 0,
            detailCount: result?.detail_count ?? 0,
            durationMs: result?.duration_ms ?? 0,
            errorCode: controller.signal.aborted
              ? "timeout"
              : (parseFailure?.code ??
                result?.error_code ??
                (result ? null : "dependency_unavailable")),
          });
          console.info(
            JSON.stringify({
              event: "amazon_health_transport_result",
              transport,
              operation: target.page_url ? "detail" : "search",
              run_id: lease.run.id,
              request_id: context.requestId,
              trace_id: context.traceId,
              status: statusValue,
              item_count: result?.item_count ?? 0,
              error_code: controller.signal.aborted
                ? "timeout"
                : (parseFailure?.code ?? result?.error_code ?? null),
            }),
          );
        }
      };
      await verifyAmazonHealthTransportParity(collect, controller.signal);
      return {
        status: "ready",
        latencyMs: Date.now() - started,
        errorCode: null,
        message: "Node浏览器与生产Python传输两条支路的搜索及同一商品详情均已实际解析。",
      };
    } catch (error) {
      if (error instanceof CrawlerRuntimeError && error.code === "crawler_claims_paused")
        throw error;
      return {
        status: "degraded",
        latencyMs: Date.now() - started,
        errorCode: controller.signal.aborted
          ? "timeout"
          : typeof (error as { code?: unknown })?.code === "string"
            ? (error as { code: string }).code
            : "dependency_unavailable",
        message: "匿名浏览器搜索或详情未通过核验。",
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
