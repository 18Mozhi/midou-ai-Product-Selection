import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { RuntimeConfig } from "@scoutops/config";
import { PlaywrightCrawlerEngine, runWithEncryptedProfile } from "@scoutops/playwright-crawler";
import { ProviderAdapterFailure, type AdapterHealthSignal } from "@scoutops/provider-adapters";
import {
  anonymousAmazonFingerprint,
  createAmazonBrowserExecutionRequest,
  parseAmazonBrowserRunResult,
  assertPublicCollectionPolicy,
} from "@scoutops/provider-sources";
import { MySqlCredentialAssetRepository } from "./mysql-credential-asset-repository.js";
import { MySqlCrawlerRuntimeRepository } from "./mysql-crawler-runtime-repository.js";
import { CrawlerRuntimeService } from "./crawler-runtime-service.js";
import type { AdapterProviderRecord, ProviderProbeContext } from "./provider-adapter-service.js";

export class AmazonPublicBrowserHealth {
  constructor(
    private readonly pool: Pool,
    private readonly config: RuntimeConfig,
    private readonly fetcher: typeof fetch,
    private readonly resolveScope: (
      context: ProviderProbeContext,
    ) => Promise<{ organizationId: string; workspaceId: string }>,
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
        "SELECT p.*,a.fingerprint,a.status asset_status,a.kind FROM crawler_profiles p JOIN credential_assets a ON a.id=p.credential_asset_id WHERE p.id=? AND p.provider_id=? AND p.status='active' AND a.status='active' AND a.kind='browser_profile' AND a.fingerprint=?",
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
      const runtime = new CrawlerRuntimeService(new MySqlCrawlerRuntimeRepository(this.pool));
      const record = await new MySqlCredentialAssetRepository(this.pool).getCipherRecord(
        String(profile.credential_asset_id),
      );
      const collect = async (target: Record<string, unknown>) => {
        const request = createAmazonBrowserExecutionRequest(target);
        controller.signal.throwIfAborted();
        await assertPublicCollectionPolicy({
          providerTargetUrl: provider.targetUrl,
          target,
          fetcher: this.fetcher,
          timeoutMs: provider.timeoutMs,
        });
        controller.signal.throwIfAborted();
        const lease = await runtime.acquire({
          ...context,
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
        }
      };
      const [product] = await collect({ query: "storage box" });
      if (!product) throw new ProviderAdapterFailure("invalid_payload", false);
      const [detail] = await collect({
        page_url: "https://www.amazon.com/dp/" + product.externalId,
      });
      if (!detail || detail.externalId !== product.externalId)
        throw new ProviderAdapterFailure("invalid_payload", false);
      return {
        status: "ready",
        latencyMs: Date.now() - started,
        errorCode: null,
        message: "匿名浏览器搜索与同一商品详情均已实际解析。",
      };
    } catch (error) {
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
