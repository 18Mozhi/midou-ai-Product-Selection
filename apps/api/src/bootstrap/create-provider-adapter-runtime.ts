import type { Pool } from "mysql2/promise";
import type { RuntimeConfig } from "@scoutops/config";
import type { AuthorizationService } from "@scoutops/authorization";
import type { ProviderAdapterRegistry } from "@scoutops/provider-adapters";
import {
  AUTOMATIC_PROVIDER_SOURCE_HOSTS,
  createProviderSourceFetch,
} from "@scoutops/provider-sources";
import { AmazonPublicBrowserHealth } from "../amazon-public-browser-health.js";
import { ProviderAdapterService } from "../provider-adapter-service.js";
import { MySqlProviderAdapterRepository } from "../mysql-provider-adapter-repository.js";
import { CrawlerSchedulerRepository } from "../crawler-scheduler-repository.js";
import {
  amazonPublicRecoveryTarget,
  resolveAmazonPublicRecoveryScope,
} from "../amazon-public-recovery.js";
import { lan1688RecoveryTarget } from "../lan-1688-recovery.js";
import { PublicRssRecovery } from "../public-rss-recovery.js";

export function createProviderAdapterRuntime(
  pool: Pool,
  config: RuntimeConfig,
  providerAdapterRegistry: ProviderAdapterRegistry,
  authorization: AuthorizationService,
) {
  const service = new ProviderAdapterService(
    new MySqlProviderAdapterRepository(pool),
    providerAdapterRegistry,
    undefined,
    config.providerAdapters.amazonBrowserProfileId
      ? (provider, context) =>
          new AmazonPublicBrowserHealth(
            pool,
            config,
            createProviderSourceFetch(
              config.providerAdapters.proxy,
              {},
              AUTOMATIC_PROVIDER_SOURCE_HOSTS,
            ),
            async (c) => {
              if (!c.sessionId)
                return resolveAmazonPublicRecoveryScope(
                  pool,
                  config.automaticSources.systemActorId,
                  c,
                );
              const resolved = await authorization.resolveSession(c.actorId, c.sessionId);
              return {
                organizationId: resolved.context.organization_id,
                workspaceId: resolved.context.workspace_id,
              };
            },
          ).probe(provider, context)
      : undefined,
  );
  const publicRssRecovery = new PublicRssRecovery(
    pool,
    service,
    new CrawlerSchedulerRepository(pool),
    {
      enabled: config.nodeEnv === "production" && config.providerAdapters.publicRssRecoveryEnabled,
      actorId: config.automaticSources.systemActorId,
      pollMs: config.providerAdapters.publicRssRecoveryPollMs,
      cooldownMs: config.providerAdapters.publicRssRecoveryCooldownMs,
    },
    undefined,
    (code) => console.warn("public_rss_auto_recovery_failed", code),
    (result) =>
      console.info(
        JSON.stringify({
          service: "product-scout-api",
          event: "public_rss_auto_recovery",
          observed_at: new Date().toISOString(),
          ...result,
        }),
      ),
  );
  const publicAmazonRecovery = new PublicRssRecovery(
    pool,
    service,
    new CrawlerSchedulerRepository(pool),
    {
      enabled:
        config.nodeEnv === "production" &&
        config.providerAdapters.amazonPublicRecoveryEnabled &&
        Boolean(config.providerAdapters.amazonBrowserProfileId),
      actorId: config.automaticSources.systemActorId,
      pollMs: config.providerAdapters.amazonPublicRecoveryPollMs,
      cooldownMs: config.providerAdapters.amazonPublicRecoveryCooldownMs,
    },
    undefined,
    () => console.warn("amazon_public_auto_recovery_failed"),
    (result) =>
      console.info(
        JSON.stringify({
          service: "product-scout-api",
          event: "amazon_public_auto_recovery",
          observed_at: new Date().toISOString(),
          ...result,
        }),
      ),
    amazonPublicRecoveryTarget,
  );
  const publicLan1688Recovery = new PublicRssRecovery(
    pool,
    service,
    new CrawlerSchedulerRepository(pool),
    {
      enabled:
        config.nodeEnv === "production" &&
        config.providerAdapters.lan1688RecoveryEnabled &&
        Boolean(config.providerAdapters.lan1688Token),
      actorId: config.automaticSources.systemActorId,
      pollMs: config.providerAdapters.lan1688RecoveryPollMs,
      cooldownMs: config.providerAdapters.lan1688RecoveryCooldownMs,
    },
    undefined,
    () => console.warn("lan_1688_auto_recovery_failed"),
    (result) =>
      console.info(
        JSON.stringify({
          service: "product-scout-api",
          event: "lan_1688_auto_recovery",
          observed_at: new Date().toISOString(),
          ...result,
        }),
      ),
    lan1688RecoveryTarget,
  );
  return { service, publicRssRecovery, publicAmazonRecovery, publicLan1688Recovery };
}
