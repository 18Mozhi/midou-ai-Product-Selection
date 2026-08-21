import { buildApp } from "./app.js";
import { readFile } from "node:fs/promises";
import { loadRuntimeConfig } from "@scoutops/config";
import { createDatabasePool } from "@scoutops/database";
import { createRedisConnection, inspectRedisResilience, ScopedRedisStore } from "@scoutops/redis";
import {
  createArgon2PasswordHasher,
  EncryptedOutboxAuthDelivery,
  LocalAuthService,
  MfaService,
  PendingAuthDelivery,
} from "@scoutops/auth";
import { MySqlAuthRepository } from "./mysql-auth-repository.js";
import { MySqlAuthOutboxStore } from "./mysql-auth-outbox.js";
import { MySqlAuthIdempotency } from "./mysql-auth-idempotency.js";
import { MySqlMfaRepository } from "./mysql-mfa-repository.js";
import { TenancyService } from "@scoutops/tenancy";
import { MySqlTenancyRepository } from "./mysql-tenancy-repository.js";
import { AuthorizationService } from "@scoutops/authorization";
import { MySqlAuthorizationRepository } from "./mysql-authorization-repository.js";
import { ResourceGrantService } from "@scoutops/resource-grants";
import { MySqlResourceGrantRepository } from "./mysql-resource-grant-repository.js";
import { AuditQueryService } from "@scoutops/audit";
import { MySqlAuditRepository } from "./mysql-audit-repository.js";
import { UiPreferenceService } from "@scoutops/preferences";
import { MySqlUiPreferenceRepository } from "./mysql-ui-preference-repository.js";
import { DiscoveryService } from "./discovery-service.js";
import { MySqlDiscoveryRepository } from "./mysql-discovery-repository.js";
import { HomeDashboardService } from "./home-dashboard-service.js";
import { MySqlHomeDashboardRepository } from "./mysql-home-dashboard-repository.js";
import { ProviderRegistryService } from "./provider-registry-service.js";
import { MySqlProviderRegistryRepository } from "./mysql-provider-registry-repository.js";
import { CredentialAssetService } from "./credential-asset-service.js";
import { MySqlCredentialAssetRepository } from "./mysql-credential-asset-repository.js";
import { ProviderAdapterRegistry } from "@scoutops/provider-adapters";
import { ProviderAdapterService } from "./provider-adapter-service.js";
import { MySqlProviderAdapterRepository } from "./mysql-provider-adapter-repository.js";
import { CrawlerRuntimeService } from "./crawler-runtime-service.js";
import { MySqlCrawlerRuntimeRepository } from "./mysql-crawler-runtime-repository.js";
import { CollectionTaskService } from "./collection-task-service.js";
import { MySqlCollectionTaskRepository } from "./mysql-collection-task-repository.js";
import {
  AUTOMATIC_PROVIDER_SOURCE_HOSTS,
  createBuiltinSourceAdapters,
  createProviderSourceFetch,
} from "@scoutops/provider-sources";
import { ProviderSourceService } from "./provider-source-service.js";
import { MySqlProviderSourceRepository } from "./mysql-provider-source-repository.js";
import { TrendService } from "./trend-service.js";
import { MySqlTrendRepository } from "./mysql-trend-repository.js";
import { OpportunityService } from "./opportunity-service.js";
import { MySqlOpportunityRepository } from "./mysql-opportunity-repository.js";
import { ErpProductImportService } from "./erp-product-import-service.js";
import { ScoringService } from "./scoring-service.js";
import { MySqlScoringRepository } from "./mysql-scoring-repository.js";
import { ProfitService } from "./profit-service.js";
import { MySqlProfitRepository } from "./mysql-profit-repository.js";
import { CompetitorService } from "./competitor-service.js";
import { MySqlCompetitorRepository } from "./mysql-competitor-repository.js";
import { SourcingService } from "./sourcing-service.js";
import { MySqlSourcingRepository } from "./mysql-sourcing-repository.js";
import { AiAnalysisService } from "./ai-analysis-service.js";
import { MySqlAiAnalysisRepository } from "./mysql-ai-analysis-repository.js";
import { SelectionJourneyService } from "./selection-journey-service.js";
import { MySqlSelectionJourneyRepository } from "./mysql-selection-journey-repository.js";
import { RuntimeTopologyService } from "./runtime-topology-service.js";
import { MySqlRuntimeTopologyRepository } from "./mysql-runtime-topology-repository.js";
import { RedisResilienceService } from "./redis-resilience-service.js";
import { MySqlRedisResilienceRepository } from "./mysql-redis-resilience-repository.js";
import { MySqlResilienceProbe } from "./mysql-resilience-probe.js";
import { MySqlResilienceRepository } from "./mysql-resilience-repository.js";
import { MySqlResilienceService } from "./mysql-resilience-service.js";
import { FileResilienceProbe } from "./file-resilience-probe.js";
import { FileResilienceRepository } from "./file-resilience-repository.js";
import { FileResilienceService } from "./file-resilience-service.js";
import { CrawlerSchedulerService } from "./crawler-scheduler-service.js";
import { CrawlerSchedulerRepository } from "./crawler-scheduler-repository.js";
import { CrawlerSchedulerHostProbe } from "./crawler-scheduler-probe.js";
import { CapacityBoundaryService } from "./capacity-boundary-service.js";
import { CapacityBoundaryRepository } from "./capacity-boundary-repository.js";
import { registerWorkflowDomainRoutes } from "./bootstrap/register-workflow-domain.js";
import { registerPlatformDomainRoutes } from "./bootstrap/register-platform-domain.js";
import { registerOperationsDomainRoutes } from "./bootstrap/register-operations-domain.js";

const config = loadRuntimeConfig(process.env, "api");
const pool = createDatabasePool(config);
const redisClient = createRedisConnection(config);
redisClient.on("error", () => {});
const redisStore = new ScopedRedisStore(redisClient);
const runtimeTopologyRepository = new MySqlRuntimeTopologyRepository(pool);
const runtimeTopologyService = new RuntimeTopologyService(runtimeTopologyRepository, {
  expectedNodeId: config.runtimeTopology.nodeId,
  expectedHostId: config.runtimeTopology.hostId,
  staleAfterMs: config.runtimeTopology.staleAfterMs,
  restartAlertThreshold: config.runtimeTopology.restartAlertThreshold,
  workerSchedulerStaleAfterMs: config.runtime.workerSchedulerStaleAfterMs,
  ...(config.runtime.workerSchedulerStateFile
    ? {
        workerSchedulerSnapshot: async () =>
          JSON.parse(await readFile(config.runtime.workerSchedulerStateFile, "utf8")),
      }
    : {}),
  ...(config.runtimeTopology.supervisorStateFile
    ? {
        supervisorSnapshot: async () =>
          JSON.parse(await readFile(config.runtimeTopology.supervisorStateFile, "utf8")),
      }
    : {}),
});
const redisResilienceService = new RedisResilienceService(
  {
    snapshot: async () => {
      await redisStore.connect();
      return inspectRedisResilience(redisClient);
    },
  },
  new MySqlRedisResilienceRepository(pool),
  config.redisResilience,
);
const mysqlResilienceService = new MySqlResilienceService(
  new MySqlResilienceProbe(pool),
  new MySqlResilienceRepository(pool),
  config.mysqlResilience,
);
const fileResilienceService = new FileResilienceService(
  new FileResilienceProbe(
    pool,
    config.storage.evidenceRoot,
    config.storage.exportRoot,
    config.fileResilience.checksumSampleLimit,
    config.fileResilience.maximumRecoveryDrillAgeDays,
  ),
  new FileResilienceRepository(pool),
  {
    usageWarningBasisPoints: config.fileResilience.usageWarningBasisPoints,
    usageStopBasisPoints: config.fileResilience.usageStopBasisPoints,
    maximumRecoveryDrillAgeDays: config.fileResilience.maximumRecoveryDrillAgeDays,
  },
);
const crawlerSchedulerService = new CrawlerSchedulerService(
  new CrawlerSchedulerRepository(pool),
  new CrawlerSchedulerHostProbe(config.storage.evidenceRoot),
  config.crawlerScheduler,
);
const capacityBoundaryService = new CapacityBoundaryService(new CapacityBoundaryRepository(pool), {
  readP95StopMs: config.capacityBoundary.readP95StopMs,
  writeP95StopMs: config.capacityBoundary.writeP95StopMs,
  errorRateStopBasisPoints: config.capacityBoundary.errorRateStopBasisPoints,
  asyncLagStopSeconds: config.capacityBoundary.asyncLagStopSeconds,
  maximumLoadBasisPoints: config.crawlerScheduler.maximumLoadBasisPoints,
  minimumAvailableMemoryMb: config.crawlerScheduler.minimumAvailableMemoryMb,
  minimumFreeDiskMb: config.crawlerScheduler.minimumFreeDiskMb,
  maximumEvidenceAgeMinutes: config.capacityBoundary.maximumEvidenceAgeMinutes,
});
const authRepository = new MySqlAuthRepository(pool);
const authOutbox = new MySqlAuthOutboxStore(pool);
const authDelivery = config.security.credentialsMasterKey
  ? new EncryptedOutboxAuthDelivery(authOutbox, config.security.credentialsMasterKey)
  : new PendingAuthDelivery();
const passwordHasher = createArgon2PasswordHasher({
  memoryCost: config.auth.argon2MemoryKib,
  timeCost: config.auth.argon2TimeCost,
  parallelism: config.auth.argon2Parallelism,
});
const mfaRepository = new MySqlMfaRepository(pool);
let localAuth: LocalAuthService;
const mfa = new MfaService({
  repository: mfaRepository,
  authRepository,
  passwordHasher,
  masterKey: config.security.credentialsMasterKey,
  policy: {
    issuer: config.mfa.issuer,
    periodSeconds: config.mfa.totpPeriodSeconds,
    digits: config.mfa.totpDigits,
    window: config.mfa.totpWindow,
    challengeTtlMinutes: config.mfa.challengeTtlMinutes,
    maxAttempts: config.mfa.maxAttempts,
    recoveryCodeCount: config.mfa.recoveryCodeCount,
  },
  completeLogin: (userId, context) => localAuth.completeSecondFactorLogin(userId, context),
  completeEnrollment: (userId) => localAuth.completeMfaEnrollment(userId),
});
localAuth = new LocalAuthService({
  repository: authRepository,
  delivery: authDelivery,
  passwordHasher,
  secondFactorGate: mfa,
  policy: {
    passwordMinLength: config.auth.passwordMinLength,
    passwordMaxLength: config.auth.passwordMaxLength,
    sessionTtlMinutes: config.auth.sessionTtlMinutes,
    actionTokenTtlMinutes: config.auth.actionTokenTtlMinutes,
    maxFailedAttempts: config.auth.maxFailedAttempts,
    lockMinutes: config.auth.lockMinutes,
  },
});
const idempotency = new MySqlAuthIdempotency(pool);
const resourceGrants = new ResourceGrantService(new MySqlResourceGrantRepository(pool));
const authorization = new AuthorizationService(
  new MySqlAuthorizationRepository(pool),
  undefined,
  resourceGrants,
);
const audit = new AuditQueryService(new MySqlAuditRepository(pool));
const providerAdapterRegistry = new ProviderAdapterRegistry({
  healthTimeoutMs: config.providerAdapters.healthTimeoutMs,
  maxResponseBytes: config.providerAdapters.maxResponseBytes,
  maxItemsPerBatch: config.providerAdapters.maxItemsPerBatch,
});
for (const adapter of createBuiltinSourceAdapters(
  createProviderSourceFetch(config.providerAdapters.proxy, {}, AUTOMATIC_PROVIDER_SOURCE_HOSTS),
))
  providerAdapterRegistry.register(adapter);
const providerSourceService = new ProviderSourceService(new MySqlProviderSourceRepository(pool));
const app = buildApp({
  logger: true,
  version: config.app.version,
  buildSha: config.app.buildSha,
  configFingerprint: config.configFingerprint,
  readinessChecks: [
    {
      name: "mysql",
      check: async () => {
        try {
          await pool.query("SELECT 1");
          return "available";
        } catch {
          return "unavailable";
        }
      },
    },
    {
      name: "redis",
      check: async (requestId, traceId) => {
        try {
          await redisStore.connect();
          return (await redisStore.health(requestId, traceId)).status;
        } catch {
          return "unavailable";
        }
      },
    },
    ...(config.runtimeTopology.supervisorStateFile
      ? [
          {
            name: "supervisor" as const,
            check: async () => {
              try {
                const snapshot = JSON.parse(
                  await readFile(config.runtimeTopology.supervisorStateFile, "utf8"),
                );
                return snapshot?.status === "ready" &&
                  snapshot?.processes?.worker?.status === "running" &&
                  snapshot?.processes?.api?.status === "running"
                  ? ("available" as const)
                  : ("unavailable" as const);
              } catch {
                return "unavailable" as const;
              }
            },
          },
        ]
      : []),
  ],
  localAuth: {
    service: localAuth,
    mfa,
    idempotency,
    webOrigin: config.app.webOrigin,
    secureCookie: config.nodeEnv === "production",
    sessionTtlMinutes: config.auth.sessionTtlMinutes,
  },
  tenancy: {
    service: new TenancyService(new MySqlTenancyRepository(pool)),
    auth: localAuth,
    idempotency,
    webOrigin: config.app.webOrigin,
    secureCookie: config.nodeEnv === "production",
  },
  authorization: {
    service: authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
  },
  resourceGrants: {
    service: resourceGrants,
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
  },
  audit: {
    service: audit,
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
  },
  uiPreferences: {
    service: new UiPreferenceService(new MySqlUiPreferenceRepository(pool)),
    auth: localAuth,
    webOrigin: config.app.webOrigin,
    secureCookie: config.nodeEnv === "production",
  },
  discovery: {
    service: new DiscoveryService(new MySqlDiscoveryRepository(pool)),
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
  },
  homeDashboard: {
    service: new HomeDashboardService(new MySqlHomeDashboardRepository(pool)),
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
  },
  providerRegistry: {
    service: new ProviderRegistryService(new MySqlProviderRegistryRepository(pool)),
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
    webOrigin: config.app.webOrigin,
  },
  credentialAssets: {
    service: new CredentialAssetService(
      new MySqlCredentialAssetRepository(pool),
      config.security.credentialsMasterKey,
      config.security.credentialsMasterKeyVersion,
    ),
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
    webOrigin: config.app.webOrigin,
  },
  providerAdapters: {
    service: new ProviderAdapterService(
      new MySqlProviderAdapterRepository(pool),
      providerAdapterRegistry,
    ),
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
    webOrigin: config.app.webOrigin,
  },
  crawlerRuntime: {
    service: new CrawlerRuntimeService(new MySqlCrawlerRuntimeRepository(pool)),
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
    webOrigin: config.app.webOrigin,
    serviceToken: config.security.crawlerServiceToken,
    serviceActorId: config.identity.crawlerActorId,
  },
  collectionTasks: {
    service: new CollectionTaskService(new MySqlCollectionTaskRepository(pool)),
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
    webOrigin: config.app.webOrigin,
  },
  providerSources: {
    service: providerSourceService,
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
    webOrigin: config.app.webOrigin,
  },
  trends: {
    service: new TrendService(new MySqlTrendRepository(pool)),
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
    webOrigin: config.app.webOrigin,
  },
  opportunities: {
    service: new OpportunityService(new MySqlOpportunityRepository(pool)),
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
    webOrigin: config.app.webOrigin,
  },
  erpProductImport: {
    service: new ErpProductImportService(
      pool,
      config.storage.evidenceRoot,
      config.evidence.maxRawBytes,
    ),
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
    webOrigin: config.app.webOrigin,
  },
  selectionJourneys: {
    service: new SelectionJourneyService(
      new MySqlSelectionJourneyRepository(pool),
      config.selectionAcceptance.deadlineMs,
    ),
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
    webOrigin: config.app.webOrigin,
  },
  scoring: {
    service: new ScoringService(new MySqlScoringRepository(pool)),
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
    webOrigin: config.app.webOrigin,
  },
  profit: {
    service: new ProfitService(new MySqlProfitRepository(pool)),
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
    webOrigin: config.app.webOrigin,
  },
  competitors: {
    service: new CompetitorService(new MySqlCompetitorRepository(pool)),
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
    webOrigin: config.app.webOrigin,
  },
  sourcing: {
    service: new SourcingService(new MySqlSourcingRepository(pool)),
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
    webOrigin: config.app.webOrigin,
  },
  aiAnalysis: {
    service: new AiAnalysisService(new MySqlAiAnalysisRepository(pool)),
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
    webOrigin: config.app.webOrigin,
  },
});
const domainContext = {
  app,
  pool,
  config,
  authorization,
  auth: localAuth,
  secureCookie: config.nodeEnv === "production",
};
registerWorkflowDomainRoutes(domainContext);
registerPlatformDomainRoutes({ ...domainContext, passwordHasher });
registerOperationsDomainRoutes({
  ...domainContext,
  runtimeTopologyService,
  redisResilienceService,
  mysqlResilienceService,
  fileResilienceService,
  crawlerSchedulerService,
  capacityBoundaryService,
});
let runtimeHeartbeatTimer: ReturnType<typeof setInterval> | undefined;
const publishRuntimeHeartbeat = async (status: "ready" | "stopped") => {
  const correlation = `runtime-${config.runtimeTopology.nodeId}-${Date.now()}`;
  await runtimeTopologyRepository.heartbeat({
    nodeId: config.runtimeTopology.nodeId,
    hostId: config.runtimeTopology.hostId,
    region: config.runtimeTopology.region,
    zone: config.runtimeTopology.zone,
    buildSha: config.app.buildSha,
    version: config.app.version,
    status,
    requestId: correlation,
    traceId: correlation,
    observedAt: new Date(),
  });
};
app.addHook("onClose", async () => {
  if (runtimeHeartbeatTimer) clearInterval(runtimeHeartbeatTimer);
  try {
    await publishRuntimeHeartbeat("stopped");
  } catch (error) {
    app.log.warn({ error }, "runtime topology stop heartbeat failed");
  }
  await redisStore.close();
  await pool.end();
});
const { host, port } = config.app;

try {
  const sourceCatalog = await providerSourceService.ensureCatalog();
  app.log.info({ sourceCatalog }, "automatic hotspot source catalog synchronized");
  await app.listen({ host, port });
  try {
    await publishRuntimeHeartbeat("ready");
  } catch (error) {
    if (config.nodeEnv === "production") throw error;
    app.log.warn({ error }, "runtime topology startup heartbeat unavailable outside production");
  }
  runtimeHeartbeatTimer = setInterval(() => {
    void publishRuntimeHeartbeat("ready").catch((error) =>
      app.log.warn({ error }, "runtime topology heartbeat failed"),
    );
  }, config.runtimeTopology.heartbeatMs);
  runtimeHeartbeatTimer.unref();
} catch (error) {
  app.log.error({ error }, "API startup failed");
  try {
    await app.close();
  } catch (closeError) {
    app.log.error({ error: closeError }, "API startup cleanup failed");
  }
  process.exitCode = 1;
}
