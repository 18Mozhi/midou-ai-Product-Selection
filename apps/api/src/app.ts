import { randomUUID } from "node:crypto";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import type { ErrorEnvelope, SuccessEnvelope } from "@scoutops/contracts";
import {
  ApiError,
  normalizeCorrelationId,
  type ReadinessCheck,
} from "./api-foundation.js";
import { AuthError, authErrorMessage } from "@scoutops/auth";
import {
  registerLocalAuthRoutes,
  type LocalAuthRouteOptions,
} from "./auth-routes.js";
import { TenancyError } from "@scoutops/tenancy";
import {
  registerTenancyRoutes,
  type TenancyRouteOptions,
} from "./tenancy-routes.js";
import { AuthorizationError } from "@scoutops/authorization";
import {
  registerAuthorizationRoutes,
  type AuthorizationRouteOptions,
} from "./authorization-routes.js";
import { ResourceGrantError } from "@scoutops/resource-grants";
import {
  registerResourceGrantRoutes,
  type ResourceGrantRouteOptions,
} from "./resource-grant-routes.js";
import { AuditError } from "@scoutops/audit";
import { registerAuditRoutes, type AuditRouteOptions } from "./audit-routes.js";
import { PreferenceError } from "@scoutops/preferences";
import {
  registerUiPreferenceRoutes,
  type UiPreferenceRouteOptions,
} from "./ui-preference-routes.js";
import { DiscoveryError } from "./discovery-service.js";
import {
  registerDiscoveryRoutes,
  type DiscoveryRouteOptions,
} from "./discovery-routes.js";
import {
  registerHomeDashboardRoutes,
  type HomeDashboardRouteOptions,
} from "./home-dashboard-routes.js";
import { ProviderRegistryError } from "./provider-registry-service.js";
import {
  registerProviderRegistryRoutes,
  type ProviderRegistryRouteOptions,
} from "./provider-registry-routes.js";
import { CredentialAssetError } from "./credential-asset-service.js";
import {
  registerCredentialAssetRoutes,
  type CredentialAssetRouteOptions,
} from "./credential-asset-routes.js";
import { ProviderAdapterServiceError } from "./provider-adapter-service.js";
import {
  registerProviderAdapterRoutes,
  type ProviderAdapterRouteOptions,
} from "./provider-adapter-routes.js";
import { CrawlerRuntimeError } from "./crawler-runtime-service.js";
import {
  registerCrawlerRuntimeRoutes,
  type CrawlerRuntimeRouteOptions,
} from "./crawler-runtime-routes.js";
import { CollectionTaskServiceError } from "./collection-task-service.js";
import {
  registerCollectionTaskRoutes,
  type CollectionTaskRouteOptions,
} from "./collection-task-routes.js";
import { DataQualityServiceError } from "./data-quality-service.js";
import {
  registerDataQualityRoutes,
  type DataQualityRouteOptions,
} from "./data-quality-routes.js";
import { ProviderSourceServiceError } from "./provider-source-service.js";
import {
  registerProviderSourceRoutes,
  type ProviderSourceRouteOptions,
} from "./provider-source-routes.js";
import { TrendServiceError } from "./trend-service.js";
import { registerTrendRoutes, type TrendRouteOptions } from "./trend-routes.js";
import { OpportunityServiceError } from "./opportunity-service.js";
import {
  registerOpportunityRoutes,
  type OpportunityRouteOptions,
} from "./opportunity-routes.js";
import { ScoringServiceError } from "./scoring-service.js";
import {
  registerScoringRoutes,
  type ScoringRouteOptions,
} from "./scoring-routes.js";
import { ProfitServiceError } from "./profit-service.js";
import {
  registerProfitRoutes,
  type ProfitRouteOptions,
} from "./profit-routes.js";
import { CompetitorServiceError } from "./competitor-service.js";
import {
  registerCompetitorRoutes,
  type CompetitorRouteOptions,
} from "./competitor-routes.js";
import { SourcingServiceError } from "./sourcing-service.js";
import {
  registerSourcingRoutes,
  type SourcingRouteOptions,
} from "./sourcing-routes.js";
import { AiAnalysisServiceError } from "./ai-analysis-service.js";
import {
  registerAiAnalysisRoutes,
  type AiAnalysisRouteOptions,
} from "./ai-analysis-routes.js";
import { BusinessTaskError } from "./business-task-service.js";
import {
  registerBusinessTaskRoutes,
  type BusinessTaskRouteOptions,
} from "./business-task-routes.js";
import { ApprovalServiceError } from "./approval-service.js";
import {
  registerApprovalRoutes,
  type ApprovalRouteOptions,
} from "./approval-routes.js";
import { NotificationServiceError } from "./notification-service.js";
import {
  registerNotificationRoutes,
  type NotificationRouteOptions,
} from "./notification-routes.js";
import { RealtimeServiceError } from "./realtime-service.js";
import {
  registerRealtimeRoutes,
  type RealtimeRouteOptions,
} from "./realtime-routes.js";
import { AutomationServiceError } from "./automation-service.js";
import { registerAutomationRoutes, type AutomationRouteOptions } from "./automation-routes.js";
import { ReportServiceError } from "./report-service.js";
import { registerReportRoutes, type ReportRouteOptions } from "./report-routes.js";
import { OrganizationAdminError } from "./organization-admin-service.js";
import { registerOrganizationAdminRoutes, type OrganizationAdminRouteOptions } from "./organization-admin-routes.js";
import { PlatformDashboardError } from "./platform-dashboard-service.js";
import { registerPlatformDashboardRoutes, type PlatformDashboardRouteOptions } from "./platform-dashboard-routes.js";
import { CollectionConsoleError } from "./collection-console-service.js";
import { registerCollectionConsoleRoutes, type CollectionConsoleRouteOptions } from "./collection-console-routes.js";
import { SecurityOperationsError } from "./security-operations-service.js";
import { registerSecurityOperationsRoutes, type SecurityOperationsRouteOptions } from "./security-operations-routes.js";
import { OpenPlatformError } from "./open-platform-service.js";
import { registerOpenPlatformRoutes, type OpenPlatformRouteOptions } from "./open-platform-routes.js";
import { CommercialError } from "./commercial-service.js";
import { registerCommercialRoutes, type CommercialRouteOptions } from "./commercial-routes.js";
import { registerBackupRecoveryRoutes, type BackupRecoveryRouteOptions } from "./backup-recovery-routes.js";
import { registerReleaseRolloutRoutes, type ReleaseRolloutRouteOptions } from "./release-rollout-routes.js";
import { registerRuntimeTopologyRoutes, type RuntimeTopologyRouteOptions } from "./runtime-topology-routes.js";
import { registerRedisResilienceRoutes, type RedisResilienceRouteOptions } from "./redis-resilience-routes.js";
import { registerMySqlResilienceRoutes, type MySqlResilienceRouteOptions } from "./mysql-resilience-routes.js";
import { registerFileResilienceRoutes, type FileResilienceRouteOptions } from "./file-resilience-routes.js";
import { CrawlerSchedulerError } from "./crawler-scheduler-service.js";
import { registerCrawlerSchedulerRoutes, type CrawlerSchedulerRouteOptions } from "./crawler-scheduler-routes.js";
import { SelectionJourneyError } from "./selection-journey-service.js";
import { registerSelectionJourneyRoutes, type SelectionJourneyRouteOptions } from "./selection-journey-routes.js";

export interface BuildAppOptions {
  version?: string;
  buildSha?: string;
  now?: () => Date;
  logger?: boolean;
  configFingerprint?: string;
  readinessChecks?: ReadinessCheck[];
  localAuth?: LocalAuthRouteOptions;
  tenancy?: TenancyRouteOptions;
  authorization?: AuthorizationRouteOptions;
  resourceGrants?: ResourceGrantRouteOptions;
  audit?: AuditRouteOptions;
  uiPreferences?: UiPreferenceRouteOptions;
  discovery?: DiscoveryRouteOptions;
  homeDashboard?: HomeDashboardRouteOptions;
  providerRegistry?: ProviderRegistryRouteOptions;
  credentialAssets?: CredentialAssetRouteOptions;
  providerAdapters?: ProviderAdapterRouteOptions;
  crawlerRuntime?: CrawlerRuntimeRouteOptions;
  collectionTasks?: CollectionTaskRouteOptions;
  dataQuality?: DataQualityRouteOptions;
  providerSources?: ProviderSourceRouteOptions;
  trends?: TrendRouteOptions;
  opportunities?: OpportunityRouteOptions;
  selectionJourneys?: SelectionJourneyRouteOptions;
  scoring?: ScoringRouteOptions;
  profit?: ProfitRouteOptions;
  competitors?: CompetitorRouteOptions;
  sourcing?: SourcingRouteOptions;
  aiAnalysis?: AiAnalysisRouteOptions;
  businessTasks?: BusinessTaskRouteOptions;
  approvals?: ApprovalRouteOptions;
  notifications?: NotificationRouteOptions;
  realtime?: RealtimeRouteOptions;
  automations?: AutomationRouteOptions;
  reports?: ReportRouteOptions;
  organizationAdmin?: OrganizationAdminRouteOptions;
  platformDashboard?: PlatformDashboardRouteOptions;
  collectionConsole?: CollectionConsoleRouteOptions;
  securityOperations?: SecurityOperationsRouteOptions;
  openPlatform?: OpenPlatformRouteOptions;
  commercial?: CommercialRouteOptions;
  backupRecovery?: BackupRecoveryRouteOptions;
  releaseRollout?: ReleaseRolloutRouteOptions;
  runtimeTopology?: RuntimeTopologyRouteOptions;
  redisResilience?: RedisResilienceRouteOptions;
  mysqlResilience?: MySqlResilienceRouteOptions;
  fileResilience?: FileResilienceRouteOptions;
  crawlerScheduler?: CrawlerSchedulerRouteOptions;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });
  const now = options.now ?? (() => new Date());
  const version = options.version ?? process.env.APP_VERSION ?? "0.1.0";
  const buildSha = options.buildSha ?? process.env.BUILD_SHA ?? "development";
  const configFingerprint = options.configFingerprint ?? "not-loaded";

  app.addHook("onRequest", async (request, reply) => {
    const requestId = normalizeCorrelationId(
      request.headers["x-request-id"],
      randomUUID,
    );
    const traceId = normalizeCorrelationId(
      request.headers["x-trace-id"],
      () => requestId,
    );
    request.headers["x-request-id"] = requestId;
    request.headers["x-trace-id"] = traceId;
    reply.header("x-request-id", requestId).header("x-trace-id", traceId);
  });

  app.get(
    "/api/v1/health/live",
    async (
      request,
    ): Promise<
      SuccessEnvelope<{
        status: "ok";
        service: "product-scout-api";
        version: string;
        build_sha: string;
      }>
    > => {
      const requestId = request.headers["x-request-id"]!.toString();
      const traceId = request.headers["x-trace-id"]!.toString();
      return {
        data: {
          status: "ok",
          service: "product-scout-api",
          version,
          build_sha: buildSha,
        },
        meta: { observed_at: now().toISOString() },
        request_id: requestId,
        trace_id: traceId,
      };
    },
  );

  app.get(
    "/api/v1/health/version",
    async (
      request,
    ): Promise<
      SuccessEnvelope<{
        version: string;
        build_sha: string;
        config_fingerprint: string;
      }>
    > => ({
      data: {
        version,
        build_sha: buildSha,
        config_fingerprint: configFingerprint,
      },
      request_id: request.headers["x-request-id"]!.toString(),
      trace_id: request.headers["x-trace-id"]!.toString(),
    }),
  );

  app.get(
    "/api/v1/health/ready",
    async (
      request,
      reply,
    ): Promise<
      | SuccessEnvelope<{
          status: "ready";
          dependencies: { mysql: "available"; redis: "available" };
        }>
      | ErrorEnvelope
    > => {
      const requestId = request.headers["x-request-id"]!.toString();
      const traceId = request.headers["x-trace-id"]!.toString();
      const checks = options.readinessChecks ?? [];
      const results = await Promise.all(
        checks.map(
          async (item) =>
            [item.name, await item.check(requestId, traceId)] as const,
        ),
      );
      const dependencies = Object.fromEntries(results) as Partial<
        Record<"mysql" | "redis", "available" | "unavailable">
      >;
      if (
        dependencies.mysql !== "available" ||
        dependencies.redis !== "available"
      ) {
        reply.code(503);
        return {
          error: {
            code: "dependency_unavailable",
            message: "API 依赖暂不可用。",
            action_hint: "稍后重试；运维人员在宝塔检查 MySQL 与 Redis。",
          },
          request_id: requestId,
          trace_id: traceId,
        };
      }
      return {
        data: {
          status: "ready",
          dependencies: { mysql: "available", redis: "available" },
        },
        meta: { observed_at: now().toISOString() },
        request_id: requestId,
        trace_id: traceId,
      };
    },
  );

  if (options.localAuth) registerLocalAuthRoutes(app, options.localAuth);
  if (options.tenancy) registerTenancyRoutes(app, options.tenancy);
  if (options.authorization)
    registerAuthorizationRoutes(app, options.authorization);
  if (options.resourceGrants)
    registerResourceGrantRoutes(app, options.resourceGrants);
  if (options.audit) registerAuditRoutes(app, options.audit);
  if (options.uiPreferences)
    registerUiPreferenceRoutes(app, options.uiPreferences);
  if (options.discovery) registerDiscoveryRoutes(app, options.discovery);
  if (options.homeDashboard)
    registerHomeDashboardRoutes(app, options.homeDashboard);
  if (options.providerRegistry)
    registerProviderRegistryRoutes(app, options.providerRegistry);
  if (options.credentialAssets)
    registerCredentialAssetRoutes(app, options.credentialAssets);
  if (options.providerAdapters)
    registerProviderAdapterRoutes(app, options.providerAdapters);
  if (options.crawlerRuntime)
    registerCrawlerRuntimeRoutes(app, options.crawlerRuntime);
  if (options.collectionTasks)
    registerCollectionTaskRoutes(app, options.collectionTasks);
  if (options.dataQuality) registerDataQualityRoutes(app, options.dataQuality);
  if (options.providerSources)
    registerProviderSourceRoutes(app, options.providerSources);
  if (options.trends) registerTrendRoutes(app, options.trends);
  if (options.opportunities)
    registerOpportunityRoutes(app, options.opportunities);
  if(options.selectionJourneys)registerSelectionJourneyRoutes(app,options.selectionJourneys);
  if (options.scoring) registerScoringRoutes(app, options.scoring);
  if (options.profit) registerProfitRoutes(app, options.profit);
  if (options.competitors) registerCompetitorRoutes(app, options.competitors);
  if (options.sourcing) registerSourcingRoutes(app, options.sourcing);
  if (options.aiAnalysis) registerAiAnalysisRoutes(app, options.aiAnalysis);
  if (options.businessTasks)
    registerBusinessTaskRoutes(app, options.businessTasks);
  if (options.approvals) registerApprovalRoutes(app, options.approvals);
  if (options.notifications)
    registerNotificationRoutes(app, options.notifications);
  if (options.realtime) registerRealtimeRoutes(app, options.realtime);
  if (options.automations) registerAutomationRoutes(app, options.automations);
  if (options.reports) registerReportRoutes(app, options.reports);
  if (options.organizationAdmin) registerOrganizationAdminRoutes(app, options.organizationAdmin);
  if (options.platformDashboard) registerPlatformDashboardRoutes(app, options.platformDashboard);
  if (options.collectionConsole) registerCollectionConsoleRoutes(app, options.collectionConsole);
  if(options.securityOperations)registerSecurityOperationsRoutes(app,options.securityOperations);
  if(options.openPlatform)registerOpenPlatformRoutes(app,options.openPlatform);
  if(options.commercial)registerCommercialRoutes(app,options.commercial);
  if(options.backupRecovery)registerBackupRecoveryRoutes(app,options.backupRecovery);
  if(options.releaseRollout)registerReleaseRolloutRoutes(app,options.releaseRollout);
  if(options.runtimeTopology)registerRuntimeTopologyRoutes(app,options.runtimeTopology);
  if(options.redisResilience)registerRedisResilienceRoutes(app,options.redisResilience);
  if(options.mysqlResilience)registerMySqlResilienceRoutes(app,options.mysqlResilience);
  if(options.fileResilience)registerFileResilienceRoutes(app,options.fileResilience);
  if(options.crawlerScheduler)registerCrawlerSchedulerRoutes(app,options.crawlerScheduler);

  app.setErrorHandler(
    async (
      error: FastifyError | ApiError,
      request,
      reply,
    ): Promise<ErrorEnvelope> => {
      const requestId = request.headers["x-request-id"]!.toString();
      const traceId = request.headers["x-trace-id"]!.toString();
      const apiError = error instanceof ApiError ? (error as ApiError) : null;
      const authError =
        error instanceof AuthError ? (error as AuthError) : null;
      const tenancyError =
        error instanceof TenancyError ? (error as TenancyError) : null;
      const authorizationError =
        error instanceof AuthorizationError
          ? (error as AuthorizationError)
          : null;
      const resourceGrantError =
        error instanceof ResourceGrantError
          ? (error as ResourceGrantError)
          : null;
      const auditError =
        error instanceof AuditError ? (error as AuditError) : null;
      const preferenceError =
        error instanceof PreferenceError ? (error as PreferenceError) : null;
      const discoveryError =
        error instanceof DiscoveryError ? (error as DiscoveryError) : null;
      const providerError =
        error instanceof ProviderRegistryError
          ? (error as ProviderRegistryError)
          : null;
      const credentialError =
        error instanceof CredentialAssetError
          ? (error as CredentialAssetError)
          : null;
      const adapterError =
        error instanceof ProviderAdapterServiceError
          ? (error as ProviderAdapterServiceError)
          : null;
      const crawlerError =
        error instanceof CrawlerRuntimeError
          ? (error as CrawlerRuntimeError)
          : null;
      const collectionError =
        error instanceof CollectionTaskServiceError
          ? (error as CollectionTaskServiceError)
          : null;
      const dataQualityError =
        error instanceof DataQualityServiceError
          ? (error as DataQualityServiceError)
          : null;
      const sourceError =
        error instanceof ProviderSourceServiceError
          ? (error as ProviderSourceServiceError)
          : null;
      const validation = "validation" in error && Boolean(error.validation);
      const businessTaskError =
        error instanceof BusinessTaskError
          ? (error as BusinessTaskError)
          : null;
      const approvalError =
        error instanceof ApprovalServiceError
          ? (error as ApprovalServiceError)
          : null;
      const notificationError =
        error instanceof NotificationServiceError
          ? (error as NotificationServiceError)
          : null;
      const realtimeError =
        error instanceof RealtimeServiceError ? error : null;
      const automationError =
        error instanceof AutomationServiceError ? error : null;
      const reportError = error instanceof ReportServiceError ? error : null;
      const organizationAdminError = error instanceof OrganizationAdminError ? error : null;
      const platformDashboardError = error instanceof PlatformDashboardError ? error : null;
      const collectionConsoleError = error instanceof CollectionConsoleError ? error : null;
      const securityOperationsError = error instanceof SecurityOperationsError ? error : null;
      const openPlatformError = error instanceof OpenPlatformError ? error : null;
      const commercialError = error instanceof CommercialError ? error : null;
      const crawlerSchedulerError=error instanceof CrawlerSchedulerError?error:null;
      const trendError =
        error instanceof TrendServiceError
          ? (error as TrendServiceError)
          : null;
      const opportunityError =
        error instanceof OpportunityServiceError
          ? (error as OpportunityServiceError)
          : null;
      const selectionJourneyError=error instanceof SelectionJourneyError?error:null;
      const scoringError =
        error instanceof ScoringServiceError
          ? (error as ScoringServiceError)
          : null;
      const profitError =
        error instanceof ProfitServiceError
          ? (error as ProfitServiceError)
          : null;
      const competitorError =
        error instanceof CompetitorServiceError
          ? (error as CompetitorServiceError)
          : null;
      const sourcingError =
        error instanceof SourcingServiceError
          ? (error as SourcingServiceError)
          : null;
      const aiAnalysisError =
        error instanceof AiAnalysisServiceError
          ? (error as AiAnalysisServiceError)
          : null;
      const statusCode =
        apiError?.statusCode ??
        authError?.statusCode ??
        tenancyError?.statusCode ??
        authorizationError?.statusCode ??
        resourceGrantError?.statusCode ??
        auditError?.statusCode ??
        preferenceError?.statusCode ??
        discoveryError?.statusCode ??
        providerError?.statusCode ??
        credentialError?.statusCode ??
        adapterError?.statusCode ??
        crawlerError?.statusCode ??
        collectionError?.statusCode ??
        dataQualityError?.statusCode ??
        sourceError?.statusCode ??
        businessTaskError?.statusCode ??
        approvalError?.statusCode ??
        notificationError?.statusCode ??
        realtimeError?.statusCode ??
        automationError?.statusCode ??
        reportError?.statusCode ??
        organizationAdminError?.statusCode ??
        platformDashboardError?.statusCode ??
        collectionConsoleError?.statusCode ??
        securityOperationsError?.statusCode ??
        openPlatformError?.statusCode ??
        commercialError?.statusCode ??
        crawlerSchedulerError?.statusCode ??
        trendError?.statusCode ??
        opportunityError?.statusCode ??
        selectionJourneyError?.statusCode ??
        scoringError?.statusCode ??
        profitError?.statusCode ??
        competitorError?.statusCode ??
        sourcingError?.statusCode ??
        aiAnalysisError?.statusCode ??
        (validation ? 400 : 500);
      reply.code(statusCode);
      const tenancyMessages: Record<string, string> = {
        organization_forbidden: "无权访问该组织。",
        workspace_not_found: "工作区不存在。",
        workspace_archived: "工作区已归档。",
        organization_slug_conflict: "组织标识已存在。",
      };
      return {
        error: {
          code:
            apiError?.code ??
            authError?.code ??
            tenancyError?.code ??
            authorizationError?.code ??
            resourceGrantError?.code ??
            auditError?.code ??
            preferenceError?.code ??
            discoveryError?.code ??
            providerError?.code ??
            credentialError?.code ??
            adapterError?.code ??
            crawlerError?.code ??
            collectionError?.code ??
            dataQualityError?.code ??
            sourceError?.code ??
            businessTaskError?.code ??
            approvalError?.code ??
            notificationError?.code ??
        realtimeError?.code ??
        automationError?.code ??
        reportError?.code ??
        organizationAdminError?.code ??
        platformDashboardError?.code ??
        collectionConsoleError?.code ??
        securityOperationsError?.code ??
        openPlatformError?.code ??
        commercialError?.code ??
        crawlerSchedulerError?.code ??
            trendError?.code ??
            opportunityError?.code ??
            selectionJourneyError?.code ??
            scoringError?.code ??
            profitError?.code ??
            competitorError?.code ??
            sourcingError?.code ??
            aiAnalysisError?.code ??
            (validation ? "schema_validation_failed" : "internal_error"),
          message:
            apiError?.message ??
            crawlerError?.message ??
            collectionError?.message ??
            dataQualityError?.message ??
            businessTaskError?.message ??
            approvalError?.message ??
            notificationError?.message ??
            realtimeError?.message ??
            organizationAdminError?.message ??
            platformDashboardError?.message ??
            collectionConsoleError?.message ??
            securityOperationsError?.message ??
            openPlatformError?.message ??
            commercialError?.message ??
            crawlerSchedulerError?.message ??
            trendError?.message ??
            opportunityError?.message ??
            selectionJourneyError?.message ??
            scoringError?.message ??
            profitError?.message ??
            competitorError?.message ??
            sourcingError?.message ??
            aiAnalysisError?.message ??
            (sourceError
              ? "首批来源请求无法处理。"
              : authError
                ? authErrorMessage(authError.code)
                : tenancyError
                  ? (tenancyMessages[tenancyError.code] ?? "租户请求无法处理。")
                  : authorizationError
                    ? "权限检查未通过。"
                    : resourceGrantError
                      ? "资源授权请求无法处理。"
                      : auditError
                        ? "审计请求无法处理。"
                        : preferenceError
                          ? "主题偏好请求无法处理。"
                          : discoveryError
                            ? "搜索请求无法处理。"
                            : providerError
                              ? "来源配置请求无法处理。"
                              : credentialError
                                ? "凭证资产请求无法处理。"
                                : adapterError
                                  ? "适配器运行请求无法处理。"
                                  : validation
                                    ? "请求字段不符合接口合同。"
                                    : "服务暂时无法处理请求。"),
          action_hint:
            apiError?.actionHint ??
            crawlerError?.actionHint ??
            collectionError?.actionHint ??
            dataQualityError?.actionHint ??
            sourceError?.actionHint ??
            businessTaskError?.actionHint ??
            approvalError?.actionHint ??
            notificationError?.actionHint ??
        realtimeError?.actionHint ??
        automationError?.actionHint ??
        reportError?.actionHint ??
        organizationAdminError?.actionHint ??
        platformDashboardError?.actionHint ??
        collectionConsoleError?.actionHint ??
        securityOperationsError?.actionHint ??
        openPlatformError?.actionHint ??
        commercialError?.actionHint ??
        crawlerSchedulerError?.actionHint ??
            trendError?.actionHint ??
            opportunityError?.actionHint ??
            selectionJourneyError?.actionHint ??
            scoringError?.actionHint ??
            profitError?.actionHint ??
            competitorError?.actionHint ??
            sourcingError?.actionHint ??
            aiAnalysisError?.actionHint ??
            authError?.actionHint ??
            tenancyError?.actionHint ??
            authorizationError?.actionHint ??
            resourceGrantError?.actionHint ??
            auditError?.actionHint ??
            preferenceError?.actionHint ??
            discoveryError?.actionHint ??
            providerError?.actionHint ??
            credentialError?.actionHint ??
            adapterError?.actionHint ??
            (validation
              ? "按 OpenAPI 修正字段后重试。"
              : "携带 request_id 联系管理员。"),
        },
        request_id: requestId,
        trace_id: traceId,
      };
    },
  );

  app.setNotFoundHandler(async (request, reply): Promise<ErrorEnvelope> => {
    const requestId = request.headers["x-request-id"]!.toString();
    const traceId = request.headers["x-trace-id"]!.toString();
    reply.code(404);
    return {
      error: {
        code: "route_not_found",
        message: "请求的接口不存在。",
        action_hint: "检查 API 版本和路径后重试。",
      },
      request_id: requestId,
      trace_id: traceId,
    };
  });

  return app;
}
