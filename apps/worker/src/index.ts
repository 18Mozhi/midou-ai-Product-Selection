import { loadRuntimeConfig } from "@scoutops/config";
import { createDatabasePool } from "@scoutops/database";
import { ProviderAdapterRegistry } from "@scoutops/provider-adapters";
import {
  AUTOMATIC_PROVIDER_SOURCE_HOSTS,
  createBuiltinSourceAdapters,
  createProviderSourceFetch,
} from "@scoutops/provider-sources";
import { createRedisConnection, ScopedRedisStore } from "@scoutops/redis";
import { MySqlAiAnalysisWorker, OpenAiCompatibleAnalysisAdapter } from "./ai-analysis-worker.js";
import { ApprovalEscalationWorker } from "./approval-escalation-worker.js";
import {
  PendingMailProvider,
  processAuthDeliveryOnce,
  QqSmtpMailProvider,
} from "./auth-delivery-worker.js";
import { MySqlAuthenticatedBrowserJobClient } from "./authenticated-browser-job-client.js";
import { MySqlAutomaticSourceScheduler } from "./automatic-source-scheduler.js";
import { AutomationWorker } from "./automation-worker.js";
import { projectBusinessTaskOnce } from "./business-task-projection-worker.js";
import {
  MySqlCollectionTaskWorkerRepository,
  processCollectionTaskOnce,
  ScopedRedisCollectionCoordinator,
} from "./collection-task-worker.js";
import { MySqlCompetitorMonitorWorker } from "./competitor-monitor-worker.js";
import { CoreCollectionProjectionWorker } from "./core-collection-projection-worker.js";
import { MySqlEvidencePersistence } from "./evidence-persistence.js";
import { NotificationOutboxWorker } from "./notification-outbox-worker.js";
import { MySqlOpportunityProfitWorker } from "./opportunity-profit-worker.js";
import { MySqlOpportunityRefreshWorker } from "./opportunity-refresh-worker.js";
import { MySqlOpportunityScoringWorker } from "./opportunity-scoring-worker.js";
import { ProviderSourceExecutor } from "./provider-source-executor.js";
import { QueueScheduler } from "./queue-scheduler.js";
import { ReportExportWorker } from "./report-export-worker.js";
import { SingleHostResourceProbe } from "./single-host-resource-probe.js";
import { MySqlSourcingProjectionWorker } from "./sourcing-projection-worker.js";
import { MySqlTrendProjectionWorker } from "./trend-projection-worker.js";
import { WebhookDeliveryWorker } from "./webhook-delivery-worker.js";
import { WorkerPollers } from "./worker-pollers.js";
import { workerQueue } from "./worker-queue-registry.js";
import { WorkerSchedulerStateWriter } from "./worker-scheduler-state.js";

const config = loadRuntimeConfig(process.env, "worker");
const pool = createDatabasePool(config);
const redisClient = createRedisConnection(config);
const redisStore = new ScopedRedisStore(redisClient);
const providerFetch = createProviderSourceFetch(
  config.providerAdapters.proxy,
  {},
  AUTOMATIC_PROVIDER_SOURCE_HOSTS,
);
const registry = new ProviderAdapterRegistry({
  healthTimeoutMs: config.providerAdapters.healthTimeoutMs,
  maxResponseBytes: config.providerAdapters.maxResponseBytes,
  maxItemsPerBatch: config.providerAdapters.maxItemsPerBatch,
});
for (const adapter of createBuiltinSourceAdapters(providerFetch)) registry.register(adapter);

const collectionRepository = new MySqlCollectionTaskWorkerRepository(pool);
const collectionResourceProbe = new SingleHostResourceProbe(
  config.storage.evidenceRoot,
  config.crawlerScheduler,
);
const coordinator = new ScopedRedisCollectionCoordinator(redisStore);
const executor = new ProviderSourceExecutor(
  pool,
  registry,
  new MySqlEvidencePersistence(pool, config.storage.evidenceRoot, config.evidence.maxRawBytes),
  config.identity.workerId,
  new MySqlAuthenticatedBrowserJobClient(
    pool,
    500,
    undefined,
    config.playwright.runTimeoutSeconds * 1000,
  ),
  providerFetch,
);
const trendProjection = new MySqlTrendProjectionWorker(
  pool,
  config.identity.workerId,
  config.trends.projectionLeaseSeconds,
);
const opportunityRefresh = new MySqlOpportunityRefreshWorker(
  pool,
  config.identity.workerId,
  config.opportunities.refreshLeaseSeconds,
);
const opportunityScoring = new MySqlOpportunityScoringWorker(
  pool,
  config.identity.workerId,
  config.scoring.leaseSeconds,
);
const opportunityProfit = new MySqlOpportunityProfitWorker(
  pool,
  config.identity.workerId,
  config.profit.leaseSeconds,
);
const competitorMonitor = new MySqlCompetitorMonitorWorker(
  pool,
  config.identity.workerId,
  config.competitorMonitor.leaseSeconds,
);
const sourcingProjection = new MySqlSourcingProjectionWorker(
  pool,
  config.identity.workerId,
  config.sourcing.leaseSeconds,
);
const aiAnalysis = new MySqlAiAnalysisWorker(
  pool,
  config.identity.workerId,
  config.ai.leaseSeconds,
  config.ai.retryLimit,
  new OpenAiCompatibleAnalysisAdapter(
    config.ai.model,
    config.ai.baseUrl,
    config.ai.apiKey,
    config.ai.timeoutMs,
  ),
);
const approvalEscalation = new ApprovalEscalationWorker(
  pool,
  config.identity.workerId,
  config.approvals.escalationLeaseSeconds,
);
const notificationOutbox = new NotificationOutboxWorker(
  pool,
  config.notifications.outboxLeaseSeconds,
  config.notifications.retryLimit,
);
const authMailProvider =
  config.authEmail.deliveryMode === "qq_smtp"
    ? new QqSmtpMailProvider({
        username: config.authEmail.qqSmtpUsername,
        authCode: config.authEmail.qqSmtpAuthCode,
        fromName: config.authEmail.fromName,
        webOrigin: config.app.webOrigin,
        timeoutMs: config.authEmail.timeoutMs,
      })
    : new PendingMailProvider();
const automation = new AutomationWorker(
  pool,
  config.identity.workerId,
  config.automations.leaseSeconds,
  config.automations.retryLimit,
);
const reportExports = new ReportExportWorker(
  pool,
  config.identity.workerId,
  config.reports.exportRoot,
  config.reports.leaseSeconds,
  config.reports.retryLimit,
  config.reports.maxRows,
);
const webhookDeliveries = new WebhookDeliveryWorker(pool, {
  workerId: config.identity.workerId,
  masterKey: config.security.credentialsMasterKey,
  leaseSeconds: config.openPlatform.webhookLeaseSeconds,
  timeoutMs: config.openPlatform.webhookTimeoutMs,
  retrySeconds: [60, 300, 900],
});
const automaticSourceScheduler = new MySqlAutomaticSourceScheduler(
  pool,
  config.automaticSources.batchSize,
  undefined,
  {
    systemActorId: config.automaticSources.systemActorId,
    tenantActiveTaskBudget: config.automaticSources.tenantActiveTaskBudget,
    queueBacklogLimit: config.automaticSources.queueBacklogLimit,
  },
);
const coreCollectionProjection = new CoreCollectionProjectionWorker(pool, config.identity.workerId);
const pollers = new WorkerPollers();
const schedulerStateWriter = new WorkerSchedulerStateWriter(
  config.runtime.workerSchedulerStateFile,
);
let scheduler: QueueScheduler | null = null;

const persistSchedulerState = async () => {
  if (!scheduler) return;
  try {
    await schedulerStateWriter.write(scheduler.snapshot());
  } catch {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        status: "scheduler_state_write_failed",
        observed_at: new Date().toISOString(),
      }),
    );
  }
};

const heartbeat = () => {
  console.log(
    JSON.stringify({
      service: "product-scout-worker",
      status: pollers.isStopping ? "stopping" : "idle",
      worker_id: config.identity.workerId,
      registered_sources: registry.describe().map((item) => item.key),
      registered_queues: scheduler?.snapshot().queues.map((queue) => queue.name) ?? [],
      scheduler: scheduler?.snapshot() ?? null,
      config_fingerprint: config.configFingerprint,
      observed_at: new Date().toISOString(),
    }),
  );
  void persistSchedulerState();
};

const queues = [
  workerQueue(
    "collection_tasks",
    config.collectionTasks.pollMs,
    pollers.create("collection_tasks", async (signal) => {
      await redisStore.connect();
      return processCollectionTaskOnce({
        repository: collectionRepository,
        coordinator,
        executor,
        workerId: config.identity.workerId,
        leaseSeconds: config.collectionTasks.leaseSeconds,
        signal,
        resourceProbe: collectionResourceProbe,
      });
    }),
  ),
  workerQueue(
    "auth_delivery",
    config.auth.outboxPollMs,
    pollers.create(
      "auth_delivery",
      () =>
        processAuthDeliveryOnce({
          pool,
          workerId: config.identity.workerId,
          masterKey: config.security.credentialsMasterKey,
          provider: authMailProvider,
        }),
      { enabled: () => Boolean(config.security.credentialsMasterKey) },
    ),
  ),
  workerQueue(
    "business_task_projection",
    config.businessTasks.pollMs,
    pollers.create("business_task_projection", () =>
      projectBusinessTaskOnce(pool, config.identity.workerId, config.businessTasks.leaseSeconds),
    ),
  ),
  workerQueue(
    "approval_escalation",
    config.approvals.escalationPollMs,
    pollers.create("approval_escalation", () => approvalEscalation.processOnce()),
  ),
  workerQueue(
    "notification_outbox",
    config.notifications.outboxPollMs,
    pollers.create("notification_outbox", () => notificationOutbox.processOnce()),
  ),
  workerQueue(
    "webhook_deliveries",
    config.openPlatform.webhookPollMs,
    pollers.create("webhook_deliveries", () => webhookDeliveries.runOnce(), {
      enabled: () => Boolean(config.security.credentialsMasterKey),
      logResult: false,
    }),
  ),
  workerQueue(
    "opportunity_refresh",
    config.opportunities.refreshPollMs,
    pollers.create("opportunity_refresh", () => opportunityRefresh.processOnce()),
  ),
  workerQueue(
    "opportunity_scoring",
    config.scoring.pollMs,
    pollers.create("opportunity_scoring", () => opportunityScoring.processOnce()),
  ),
  workerQueue(
    "opportunity_profit",
    config.profit.pollMs,
    pollers.create("opportunity_profit", () => opportunityProfit.processOnce()),
  ),
  workerQueue(
    "competitor_monitor",
    config.competitorMonitor.pollMs,
    pollers.create("competitor_monitor", () => competitorMonitor.processOnce()),
  ),
  workerQueue(
    "sourcing_projection",
    config.sourcing.pollMs,
    pollers.create("sourcing_projection", () => sourcingProjection.processOnce()),
  ),
  workerQueue(
    "trend_projection",
    config.trends.projectionPollMs,
    pollers.create("trend_projection", () => trendProjection.processOnce()),
  ),
  workerQueue(
    "ai_analysis",
    config.ai.pollMs,
    pollers.create("ai_analysis", () => aiAnalysis.processOnce()),
  ),
  workerQueue(
    "report_exports",
    config.reports.pollMs,
    pollers.create("report_exports", () => reportExports.processOnce()),
  ),
  workerQueue(
    "automation_rules",
    config.automations.pollMs,
    pollers.create("automation_rules", () => automation.processOnce()),
  ),
  workerQueue(
    "core_collection_projection",
    2_000,
    pollers.create("core_collection_projection", () => coreCollectionProjection.processOnce()),
  ),
  workerQueue(
    "automatic_rule_sources",
    config.automaticSources.pollMs,
    pollers.create("automatic_rule_sources", () => automaticSourceScheduler.processRuleOnce()),
  ),
  workerQueue(
    "automatic_full_sources",
    config.automaticSources.pollMs,
    pollers.create("automatic_full_sources", () => automaticSourceScheduler.processFullOnce()),
  ),
];

scheduler = new QueueScheduler({
  maxConcurrency: config.runtime.workerMaxConcurrency,
  tickMs: config.runtime.workerSchedulerTickMs,
  onSnapshot: (snapshot) => schedulerStateWriter.write(snapshot),
  onSnapshotError: (error) =>
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        status: "scheduler_state_write_failed",
        error: error instanceof Error ? error.message.slice(0, 240) : "unknown",
        observed_at: new Date().toISOString(),
      }),
    ),
});
for (const queue of queues) scheduler.register(queue);
scheduler.start();
heartbeat();
const heartbeatTimer = setInterval(heartbeat, config.runtime.workerHeartbeatMs);

const stop = async (signal: string) => {
  if (pollers.isStopping) return;
  pollers.requestStop();
  clearInterval(heartbeatTimer);
  await scheduler?.stop();
  await pollers.waitForIdle();
  await persistSchedulerState();
  await redisStore.close();
  await pool.end();
  console.log(
    JSON.stringify({
      service: "product-scout-worker",
      status: "stopped",
      signal,
      worker_id: config.identity.workerId,
      observed_at: new Date().toISOString(),
    }),
  );
};
process.once("SIGTERM", () => void stop("SIGTERM"));
process.once("SIGINT", () => void stop("SIGINT"));
