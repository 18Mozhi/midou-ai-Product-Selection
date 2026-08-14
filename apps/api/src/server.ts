import { buildApp } from "./app.js";
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
import { DataQualityService } from "./data-quality-service.js";
import { MySqlDataQualityRepository } from "./mysql-data-quality-repository.js";
import { registerDataQualityRoutes } from "./data-quality-routes.js";
import {
  createBuiltinSourceAdapters,
  createProviderSourceFetch,
} from "@scoutops/provider-sources";
import { ProviderSourceService } from "./provider-source-service.js";
import { MySqlProviderSourceRepository } from "./mysql-provider-source-repository.js";
import { TrendService } from "./trend-service.js";
import { MySqlTrendRepository } from "./mysql-trend-repository.js";
import { OpportunityService } from "./opportunity-service.js";
import { MySqlOpportunityRepository } from "./mysql-opportunity-repository.js";
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
import { BusinessTaskService } from "./business-task-service.js";
import { MySqlBusinessTaskRepository } from "./mysql-business-task-repository.js";
import { registerBusinessTaskRoutes } from "./business-task-routes.js";
import { ApprovalService } from "./approval-service.js";
import { MySqlApprovalRepository } from "./mysql-approval-repository.js";
import { registerApprovalRoutes } from "./approval-routes.js";
import { NotificationService } from "./notification-service.js";
import { MySqlNotificationRepository } from "./mysql-notification-repository.js";
import { registerNotificationRoutes } from "./notification-routes.js";
import { RealtimeService } from "./realtime-service.js";
import { MySqlRealtimeRepository } from "./mysql-realtime-repository.js";
import { registerRealtimeRoutes } from "./realtime-routes.js";
import { AutomationService } from "./automation-service.js";
import { MySqlAutomationRepository } from "./mysql-automation-repository.js";
import { registerAutomationRoutes } from "./automation-routes.js";
import { ReportService } from "./report-service.js";
import { MySqlReportRepository } from "./mysql-report-repository.js";
import { registerReportRoutes } from "./report-routes.js";
import { OrganizationAdminService } from "./organization-admin-service.js";
import { MySqlOrganizationAdminRepository } from "./mysql-organization-admin-repository.js";
import { registerOrganizationAdminRoutes } from "./organization-admin-routes.js";
import { PlatformDashboardService } from "./platform-dashboard-service.js";
import { MySqlPlatformDashboardRepository } from "./mysql-platform-dashboard-repository.js";
import { registerPlatformDashboardRoutes } from "./platform-dashboard-routes.js";
import { CollectionConsoleService } from "./collection-console-service.js";
import { MySqlCollectionConsoleRepository } from "./mysql-collection-console-repository.js";
import { registerCollectionConsoleRoutes } from "./collection-console-routes.js";
import { SecurityOperationsService } from "./security-operations-service.js";
import { MySqlSecurityOperationsRepository } from "./mysql-security-operations-repository.js";
import { registerSecurityOperationsRoutes } from "./security-operations-routes.js";
import { OpenPlatformService } from "./open-platform-service.js";
import { MySqlOpenPlatformRepository } from "./mysql-open-platform-repository.js";
import { registerOpenPlatformRoutes } from "./open-platform-routes.js";
import { CommercialService } from "./commercial-service.js";
import { MySqlCommercialRepository } from "./mysql-commercial-repository.js";
import { registerCommercialRoutes } from "./commercial-routes.js";
import { BackupRecoveryService } from "./backup-recovery-service.js";
import { MySqlBackupRecoveryRepository } from "./mysql-backup-recovery-repository.js";
import { registerBackupRecoveryRoutes } from "./backup-recovery-routes.js";
import { ReleaseRolloutService, ReleaseWriteProbeService } from "./release-rollout-service.js";
import { MySqlReleaseRolloutRepository } from "./mysql-release-rollout-repository.js";
import { registerReleaseRolloutRoutes } from "./release-rollout-routes.js";
import { SelectionJourneyService } from "./selection-journey-service.js";
import { MySqlSelectionJourneyRepository } from "./mysql-selection-journey-repository.js";
import { RuntimeTopologyService } from "./runtime-topology-service.js";
import { MySqlRuntimeTopologyRepository } from "./mysql-runtime-topology-repository.js";
import { registerRuntimeTopologyRoutes } from "./runtime-topology-routes.js";
import { RedisResilienceService } from "./redis-resilience-service.js";
import { MySqlRedisResilienceRepository } from "./mysql-redis-resilience-repository.js";
import { registerRedisResilienceRoutes } from "./redis-resilience-routes.js";

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
});
const redisResilienceService = new RedisResilienceService(
  {snapshot:async()=>{await redisStore.connect();return inspectRedisResilience(redisClient);}},
  new MySqlRedisResilienceRepository(pool),
  config.redisResilience,
);
const authRepository = new MySqlAuthRepository(pool);
const authOutbox = new MySqlAuthOutboxStore(pool);
const authDelivery = config.security.credentialsMasterKey
  ? new EncryptedOutboxAuthDelivery(
      authOutbox,
      config.security.credentialsMasterKey,
    )
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
  completeLogin: (userId, context) =>
    localAuth.completeSecondFactorLogin(userId, context),
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
const resourceGrants = new ResourceGrantService(
  new MySqlResourceGrantRepository(pool),
);
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
  createProviderSourceFetch(config.providerAdapters.proxy),
))
  providerAdapterRegistry.register(adapter);
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
  ],
  localAuth: {
    service: localAuth,
    mfa,
    idempotency,
    webOrigin: config.app.webOrigin,
    secureCookie: config.nodeEnv === "production",
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
    service: new ProviderRegistryService(
      new MySqlProviderRegistryRepository(pool),
    ),
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
  },
  collectionTasks: {
    service: new CollectionTaskService(new MySqlCollectionTaskRepository(pool)),
    authorization,
    auth: localAuth,
    secureCookie: config.nodeEnv === "production",
    webOrigin: config.app.webOrigin,
  },
  providerSources: {
    service: new ProviderSourceService(new MySqlProviderSourceRepository(pool)),
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
  selectionJourneys:{
    service:new SelectionJourneyService(new MySqlSelectionJourneyRepository(pool),config.selectionAcceptance.deadlineMs),
    authorization,
    auth:localAuth,
    secureCookie:config.nodeEnv==="production",
    webOrigin:config.app.webOrigin,
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
registerBusinessTaskRoutes(app, {
  service: new BusinessTaskService(new MySqlBusinessTaskRepository(pool)),
  authorization,
  auth: localAuth,
  secureCookie: config.nodeEnv === "production",
  webOrigin: config.app.webOrigin,
});
registerApprovalRoutes(app, {
  service: new ApprovalService(new MySqlApprovalRepository(pool)),
  authorization,
  auth: localAuth,
  secureCookie: config.nodeEnv === "production",
  webOrigin: config.app.webOrigin,
});
registerNotificationRoutes(app, {
  service: new NotificationService(new MySqlNotificationRepository(pool)),
  authorization,
  auth: localAuth,
  secureCookie: config.nodeEnv === "production",
  webOrigin: config.app.webOrigin,
});
registerRealtimeRoutes(app, {
  service: new RealtimeService(
    new MySqlRealtimeRepository(pool),
    config.realtime.replayLimit,
  ),
  authorization,
  auth: localAuth,
  secureCookie: config.nodeEnv === "production",
  webOrigin: config.app.webOrigin,
  pollMs: config.realtime.pollMs,
  heartbeatMs: config.realtime.heartbeatMs,
  maxConnectionSeconds: config.realtime.maxConnectionSeconds,
  maxConnections: config.realtime.maxConnections,
});
registerAutomationRoutes(app, {
  service: new AutomationService(new MySqlAutomationRepository(pool), config.automations.defaultRateLimit),
  authorization,
  auth: localAuth,
  secureCookie: config.nodeEnv === "production",
  webOrigin: config.app.webOrigin,
});
registerReportRoutes(app, {
  service: new ReportService(new MySqlReportRepository(pool), config.reports.exportRoot, config.reports.exportTtlHours),
  authorization,
  auth: localAuth,
  secureCookie: config.nodeEnv === "production",
  webOrigin: config.app.webOrigin,
});
registerOrganizationAdminRoutes(app, {
  service: new OrganizationAdminService(
    new MySqlOrganizationAdminRepository(pool),
    config.organizationAdmin.invitationTtlHours,
    config.organizationAdmin.tokenDefaultTtlDays,
    config.organizationAdmin.tokenMaxActive,
  ),
  authorization,
  auth: localAuth,
  secureCookie: config.nodeEnv === "production",
  webOrigin: config.app.webOrigin,
});
registerPlatformDashboardRoutes(app, {
  service: new PlatformDashboardService(
    new MySqlPlatformDashboardRepository(pool, config.platformDashboard.queueWarning, config.platformDashboard.errorLimit),
    config.platformDashboard.defaultWindow,
  ),
  authorization,
  auth: localAuth,
  secureCookie: config.nodeEnv === "production",
});
registerCollectionConsoleRoutes(app, {
  service: new CollectionConsoleService(new MySqlCollectionConsoleRepository(pool), config.collectionConsole.recentLimit),
  authorization,
  auth: localAuth,
  secureCookie: config.nodeEnv === "production",
});
registerSecurityOperationsRoutes(app,{service:new SecurityOperationsService(new MySqlSecurityOperationsRepository(pool),config.securityOperations.defaultWindow,config.securityOperations.recentLimit),authorization,auth:localAuth,secureCookie:config.nodeEnv==="production"});
registerOpenPlatformRoutes(app,{service:new OpenPlatformService(new MySqlOpenPlatformRepository(pool),config.security.credentialsMasterKey,config.security.credentialsMasterKeyVersion,{clientTtlDays:config.openPlatform.clientTtlDays,defaultQuota:config.openPlatform.defaultQuotaPerMinute,maxQuota:config.openPlatform.maxQuotaPerMinute,timestampToleranceSeconds:config.openPlatform.timestampToleranceSeconds,nonceTtlSeconds:config.openPlatform.nonceTtlSeconds}),authorization,auth:localAuth,secureCookie:config.nodeEnv==="production",webOrigin:config.app.webOrigin,version:config.app.version});
registerCommercialRoutes(app,{service:new CommercialService(new MySqlCommercialRepository(pool),config.commercial.recentLimit),authorization,auth:localAuth,secureCookie:config.nodeEnv==="production",webOrigin:config.app.webOrigin});
registerBackupRecoveryRoutes(app,{service:new BackupRecoveryService(new MySqlBackupRecoveryRepository(pool),config.backupRecovery),authorization,auth:localAuth,secureCookie:config.nodeEnv==="production"});
const releaseRolloutRepository = new MySqlReleaseRolloutRepository(pool);
registerReleaseRolloutRoutes(app,{service:new ReleaseRolloutService(releaseRolloutRepository,{percentages:[5,25,100],...config.releaseRollout}),writeProbeService:new ReleaseWriteProbeService(releaseRolloutRepository,config.security.releaseProbeSigningKey,config.app.buildSha,config.releaseRollout.probeTimestampToleranceSeconds),authorization,auth:localAuth,secureCookie:config.nodeEnv==="production"});
registerRuntimeTopologyRoutes(app,{service:runtimeTopologyService,authorization,auth:localAuth,secureCookie:config.nodeEnv==="production"});
registerRedisResilienceRoutes(app,{service:redisResilienceService,authorization,auth:localAuth,secureCookie:config.nodeEnv==="production"});
registerDataQualityRoutes(app, {
  service: new DataQualityService(new MySqlDataQualityRepository(pool), {
    evidenceRoot: config.storage.evidenceRoot,
    downloadSigningKey: config.security.evidenceDownloadSigningKey,
    downloadGrantSeconds: config.evidence.downloadGrantSeconds,
  }),
  authorization,
  auth: localAuth,
  secureCookie: config.nodeEnv === "production",
  webOrigin: config.app.webOrigin,
});
let runtimeHeartbeatTimer: ReturnType<typeof setInterval> | undefined;
const publishRuntimeHeartbeat = async (status: "ready" | "stopped") => {
  const correlation = `runtime-${config.runtimeTopology.nodeId}-${Date.now()}`;
  await runtimeTopologyRepository.heartbeat({nodeId:config.runtimeTopology.nodeId,hostId:config.runtimeTopology.hostId,region:config.runtimeTopology.region,zone:config.runtimeTopology.zone,buildSha:config.app.buildSha,version:config.app.version,status,requestId:correlation,traceId:correlation,observedAt:new Date()});
};
app.addHook("onClose", async () => {
  if(runtimeHeartbeatTimer)clearInterval(runtimeHeartbeatTimer);
  try{await publishRuntimeHeartbeat("stopped");}catch(error){app.log.warn({error},"runtime topology stop heartbeat failed");}
  await redisStore.close();
  await pool.end();
});
const { host, port } = config.app;

try {
  await app.listen({ host, port });
  try {
    await publishRuntimeHeartbeat("ready");
  } catch (error) {
    if (config.nodeEnv === "production") throw error;
    app.log.warn({ error }, "runtime topology startup heartbeat unavailable outside production");
  }
  runtimeHeartbeatTimer=setInterval(()=>{void publishRuntimeHeartbeat("ready").catch(error=>app.log.warn({error},"runtime topology heartbeat failed"));},config.runtimeTopology.heartbeatMs);
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
