import { loadRuntimeConfig } from "@scoutops/config";
import { createDatabasePool } from "@scoutops/database";
import { createRedisConnection, ScopedRedisStore } from "@scoutops/redis";
import { ProviderAdapterRegistry } from "@scoutops/provider-adapters";
import {
  AUTOMATIC_PROVIDER_SOURCE_HOSTS,
  createBuiltinSourceAdapters,
  createProviderSourceFetch,
} from "@scoutops/provider-sources";
import { PendingMailProvider, processAuthDeliveryOnce } from "./auth-delivery-worker.js";
import {
  MySqlCollectionTaskWorkerRepository,
  ScopedRedisCollectionCoordinator,
  processCollectionTaskOnce,
} from "./collection-task-worker.js";
import { MySqlEvidencePersistence } from "./evidence-persistence.js";
import { ProviderSourceExecutor } from "./provider-source-executor.js";
import { MySqlAuthenticatedBrowserJobClient } from "./authenticated-browser-job-client.js";
import { SingleHostResourceProbe } from "./single-host-resource-probe.js";
import { MySqlTrendProjectionWorker } from "./trend-projection-worker.js";
import { MySqlOpportunityRefreshWorker } from "./opportunity-refresh-worker.js";
import { MySqlOpportunityScoringWorker } from "./opportunity-scoring-worker.js";
import { MySqlOpportunityProfitWorker } from "./opportunity-profit-worker.js";
import { MySqlCompetitorMonitorWorker } from "./competitor-monitor-worker.js";
import { MySqlSourcingProjectionWorker } from "./sourcing-projection-worker.js";
import { MySqlAiAnalysisWorker, OpenAiCompatibleAnalysisAdapter } from "./ai-analysis-worker.js";
import { projectBusinessTaskOnce } from "./business-task-projection-worker.js";
import { ApprovalEscalationWorker } from "./approval-escalation-worker.js";
import { NotificationOutboxWorker } from "./notification-outbox-worker.js";
import { AutomationWorker } from "./automation-worker.js";
import { ReportExportWorker } from "./report-export-worker.js";
import { WebhookDeliveryWorker } from "./webhook-delivery-worker.js";
import { MySqlAutomaticSourceScheduler } from "./automatic-source-scheduler.js";
import { CoreCollectionProjectionWorker } from "./core-collection-projection-worker.js";
import { QueueScheduler } from "./queue-scheduler.js";
import { WorkerSchedulerStateWriter } from "./worker-scheduler-state.js";

const config = loadRuntimeConfig(process.env, "worker");
const pool = createDatabasePool(config);
const redisClient = createRedisConnection(config);
const redisStore = new ScopedRedisStore(redisClient);
const registry = new ProviderAdapterRegistry({
  healthTimeoutMs: config.providerAdapters.healthTimeoutMs,
  maxResponseBytes: config.providerAdapters.maxResponseBytes,
  maxItemsPerBatch: config.providerAdapters.maxItemsPerBatch,
});
for (const adapter of createBuiltinSourceAdapters(
  createProviderSourceFetch(config.providerAdapters.proxy, {}, AUTOMATIC_PROVIDER_SOURCE_HOSTS),
))
  registry.register(adapter);
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
const automaticSourceScheduler = new MySqlAutomaticSourceScheduler(pool);
const coreCollectionProjection = new CoreCollectionProjectionWorker(pool, config.identity.workerId);
let stopping = false,
  authPolling = false,
  collectionPolling = false,
  trendPolling = false,
  opportunityPolling = false,
  scoringPolling = false,
  profitPolling = false,
  competitorPolling = false,
  sourcingPolling = false,
  aiPolling = false,
  businessTaskPolling = false,
  approvalPolling = false,
  notificationPolling = false,
  automationPolling = false,
  reportPolling = false,
  webhookPolling = false,
  automaticSourcePolling = false;
let coreProjectionPolling = false;
let scheduler: QueueScheduler | null = null;
const schedulerStateWriter = new WorkerSchedulerStateWriter(
  config.runtime.workerSchedulerStateFile,
);

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
      status: stopping ? "stopping" : "idle",
      worker_id: config.identity.workerId,
      registered_sources: registry.describe().map((item) => item.key),
      trend_projection: "registered",
      opportunity_refresh: "registered",
      opportunity_scoring: "registered",
      opportunity_profit: "registered",
      competitor_monitor: "registered",
      sourcing_projection: "registered",
      ai_analysis: "registered",
      approval_escalation: "registered",
      notification_outbox: "registered",
      automation_rules: "registered",
      report_exports: "registered",
      core_collection_projection: "registered",
      webhook_deliveries: "registered",
      scheduler: scheduler?.snapshot() ?? null,
      config_fingerprint: config.configFingerprint,
      observed_at: new Date().toISOString(),
    }),
  );
  void persistSchedulerState();
};
const pollAuth = async () => {
  if (stopping || authPolling || !config.security.credentialsMasterKey) return;
  authPolling = true;
  try {
    const result = await processAuthDeliveryOnce({
      pool,
      workerId: config.identity.workerId,
      masterKey: config.security.credentialsMasterKey,
      provider: new PendingMailProvider(),
    });
    if (result.status !== "idle")
      console.log(
        JSON.stringify({
          service: "product-scout-worker",
          queue: "auth_delivery",
          ...result,
          observed_at: new Date().toISOString(),
        }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        queue: "auth_delivery",
        status: "dependency_failed",
        observed_at: new Date().toISOString(),
      }),
    );
    throw error;
  } finally {
    authPolling = false;
  }
};
const pollCollection = async () => {
  if (stopping || collectionPolling) return;
  collectionPolling = true;
  try {
    await redisStore.connect();
    const result = await processCollectionTaskOnce({
      repository: collectionRepository,
      coordinator,
      executor,
      workerId: config.identity.workerId,
      leaseSeconds: config.collectionTasks.leaseSeconds,
      resourceProbe: collectionResourceProbe,
    });
    if (result.status !== "idle")
      console.log(
        JSON.stringify({
          service: "product-scout-worker",
          queue: "collection_tasks",
          ...result,
          observed_at: new Date().toISOString(),
        }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        queue: "collection_tasks",
        status: "dependency_failed",
        error: error instanceof Error ? error.message : "unknown",
        observed_at: new Date().toISOString(),
      }),
    );
    throw error;
  } finally {
    collectionPolling = false;
  }
};
const pollTrends = async () => {
  if (stopping || trendPolling) return;
  trendPolling = true;
  try {
    const result = await trendProjection.processOnce();
    if (result.status !== "idle")
      console.log(
        JSON.stringify({
          service: "product-scout-worker",
          queue: "trend_projection",
          ...result,
          observed_at: new Date().toISOString(),
        }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        queue: "trend_projection",
        status: "dependency_failed",
        error: error instanceof Error ? error.message : "unknown",
        observed_at: new Date().toISOString(),
      }),
    );
    throw error;
  } finally {
    trendPolling = false;
  }
};
const pollOpportunities = async () => {
  if (stopping || opportunityPolling) return;
  opportunityPolling = true;
  try {
    const result = await opportunityRefresh.processOnce();
    if (result.status !== "idle")
      console.log(
        JSON.stringify({
          service: "product-scout-worker",
          queue: "opportunity_refresh",
          ...result,
          observed_at: new Date().toISOString(),
        }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        queue: "opportunity_refresh",
        status: "dependency_failed",
        error: error instanceof Error ? error.message : "unknown",
        observed_at: new Date().toISOString(),
      }),
    );
    throw error;
  } finally {
    opportunityPolling = false;
  }
};
const pollScoring = async () => {
  if (stopping || scoringPolling) return;
  scoringPolling = true;
  try {
    const result = await opportunityScoring.processOnce();
    if (result.status !== "idle")
      console.log(
        JSON.stringify({
          service: "product-scout-worker",
          queue: "opportunity_scoring",
          ...result,
          observed_at: new Date().toISOString(),
        }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        queue: "opportunity_scoring",
        status: "dependency_failed",
        error: error instanceof Error ? error.message : "unknown",
        observed_at: new Date().toISOString(),
      }),
    );
    throw error;
  } finally {
    scoringPolling = false;
  }
};
const pollProfit = async () => {
  if (stopping || profitPolling) return;
  profitPolling = true;
  try {
    const result = await opportunityProfit.processOnce();
    if (result.status !== "idle")
      console.log(
        JSON.stringify({
          service: "product-scout-worker",
          queue: "opportunity_profit",
          ...result,
          observed_at: new Date().toISOString(),
        }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        queue: "opportunity_profit",
        status: "dependency_failed",
        error: error instanceof Error ? error.message : "unknown",
        observed_at: new Date().toISOString(),
      }),
    );
    throw error;
  } finally {
    profitPolling = false;
  }
};
const pollCompetitors = async () => {
  if (stopping || competitorPolling) return;
  competitorPolling = true;
  try {
    const result = await competitorMonitor.processOnce();
    if (result.status !== "idle")
      console.log(
        JSON.stringify({
          service: "product-scout-worker",
          queue: "competitor_monitor",
          ...result,
          observed_at: new Date().toISOString(),
        }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        queue: "competitor_monitor",
        status: "dependency_failed",
        error: error instanceof Error ? error.message : "unknown",
        observed_at: new Date().toISOString(),
      }),
    );
    throw error;
  } finally {
    competitorPolling = false;
  }
};
const pollSourcing = async () => {
  if (stopping || sourcingPolling) return;
  sourcingPolling = true;
  try {
    const result = await sourcingProjection.processOnce();
    if (result.status !== "idle")
      console.log(
        JSON.stringify({
          service: "product-scout-worker",
          queue: "sourcing_projection",
          ...result,
          observed_at: new Date().toISOString(),
        }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        queue: "sourcing_projection",
        status: "dependency_failed",
        error: error instanceof Error ? error.message : "unknown",
        observed_at: new Date().toISOString(),
      }),
    );
    throw error;
  } finally {
    sourcingPolling = false;
  }
};
const pollAi = async () => {
  if (stopping || aiPolling) return;
  aiPolling = true;
  try {
    const result = await aiAnalysis.processOnce();
    if (result.status !== "idle")
      console.log(
        JSON.stringify({
          service: "product-scout-worker",
          queue: "ai_analysis",
          ...result,
          observed_at: new Date().toISOString(),
        }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        queue: "ai_analysis",
        status: "dependency_failed",
        observed_at: new Date().toISOString(),
      }),
    );
    throw error;
  } finally {
    aiPolling = false;
  }
};
const pollBusinessTasks = async () => {
  if (stopping || businessTaskPolling) return;
  businessTaskPolling = true;
  try {
    const result = await projectBusinessTaskOnce(
      pool,
      config.identity.workerId,
      config.businessTasks.leaseSeconds,
    );
    if (result.status !== "idle")
      console.log(
        JSON.stringify({
          service: "product-scout-worker",
          queue: "business_task_projection",
          ...result,
          observed_at: new Date().toISOString(),
        }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        queue: "business_task_projection",
        status: "dependency_failed",
        error: error instanceof Error ? error.message : "unknown",
        observed_at: new Date().toISOString(),
      }),
    );
    throw error;
  } finally {
    businessTaskPolling = false;
  }
};
const pollApprovals = async () => {
  if (stopping || approvalPolling) return;
  approvalPolling = true;
  try {
    const result = await approvalEscalation.processOnce();
    if (result.status !== "idle")
      console.log(
        JSON.stringify({
          service: "product-scout-worker",
          queue: "approval_escalation",
          ...result,
          observed_at: new Date().toISOString(),
        }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        queue: "approval_escalation",
        status: "dependency_failed",
        error: error instanceof Error ? error.message : "unknown",
        observed_at: new Date().toISOString(),
      }),
    );
    throw error;
  } finally {
    approvalPolling = false;
  }
};
const pollNotifications = async () => {
  if (stopping || notificationPolling) return;
  notificationPolling = true;
  try {
    const result = await notificationOutbox.processOnce();
    if (result.status !== "idle")
      console.log(
        JSON.stringify({
          service: "product-scout-worker",
          queue: "notification_outbox",
          ...result,
          observed_at: new Date().toISOString(),
        }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        queue: "notification_outbox",
        status: "dependency_failed",
        error: error instanceof Error ? error.message : "unknown",
        observed_at: new Date().toISOString(),
      }),
    );
    throw error;
  } finally {
    notificationPolling = false;
  }
};
const pollAutomations = async () => {
  if (stopping || automationPolling) return;
  automationPolling = true;
  try {
    const result = await automation.processOnce();
    if (result.status !== "idle")
      console.log(
        JSON.stringify({
          service: "product-scout-worker",
          queue: "automation_rules",
          ...result,
          observed_at: new Date().toISOString(),
        }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        queue: "automation_rules",
        status: "dependency_failed",
        error: error instanceof Error ? error.message : "unknown",
        observed_at: new Date().toISOString(),
      }),
    );
    throw error;
  } finally {
    automationPolling = false;
  }
};
const pollReports = async () => {
  if (stopping || reportPolling) return;
  reportPolling = true;
  try {
    const result = await reportExports.processOnce();
    if (result.status !== "idle")
      console.log(
        JSON.stringify({
          service: "product-scout-worker",
          queue: "report_exports",
          ...result,
          observed_at: new Date().toISOString(),
        }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        queue: "report_exports",
        status: "dependency_failed",
        error: error instanceof Error ? error.message : "unknown",
        observed_at: new Date().toISOString(),
      }),
    );
    throw error;
  } finally {
    reportPolling = false;
  }
};
const pollWebhooks = async () => {
  if (stopping || webhookPolling || !config.security.credentialsMasterKey) return;
  webhookPolling = true;
  try {
    await webhookDeliveries.runOnce();
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        queue: "webhook_deliveries",
        status: "dependency_failed",
        error: error instanceof Error ? error.message : "unknown",
        observed_at: new Date().toISOString(),
      }),
    );
    throw error;
  } finally {
    webhookPolling = false;
  }
};
const pollAutomaticSources = async () => {
  if (stopping || automaticSourcePolling) return;
  automaticSourcePolling = true;
  try {
    const result = await automaticSourceScheduler.processOnce();
    if (result.status !== "idle")
      console.log(
        JSON.stringify({
          service: "product-scout-worker",
          queue: "automatic_hotspot_sources",
          ...result,
          observed_at: new Date().toISOString(),
        }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        queue: "automatic_hotspot_sources",
        status: "dependency_failed",
        error: error instanceof Error ? error.message : "unknown",
        observed_at: new Date().toISOString(),
      }),
    );
    throw error;
  } finally {
    automaticSourcePolling = false;
  }
};
const pollCoreProjection = async () => {
  if (stopping || coreProjectionPolling) return;
  coreProjectionPolling = true;
  try {
    const result = await coreCollectionProjection.processOnce();
    if (result.status !== "idle")
      console.log(
        JSON.stringify({
          service: "product-scout-worker",
          queue: "core_collection_projection",
          ...result,
          observed_at: new Date().toISOString(),
        }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "product-scout-worker",
        queue: "core_collection_projection",
        status: "dependency_failed",
        error: error instanceof Error ? error.message : "unknown",
        observed_at: new Date().toISOString(),
      }),
    );
    throw error;
  } finally {
    coreProjectionPolling = false;
  }
};

// One scheduler owns priority, global concurrency and backpressure for every queue.
scheduler = new QueueScheduler({
  maxConcurrency: config.runtime.workerMaxConcurrency,
  tickMs: config.runtime.workerSchedulerTickMs,
})
  .register({
    name: "collection_tasks",
    priority: 100,
    intervalMs: config.collectionTasks.pollMs,
    run: pollCollection,
  })
  .register({
    name: "auth_delivery",
    priority: 95,
    intervalMs: config.auth.outboxPollMs,
    run: pollAuth,
  })
  .register({
    name: "business_task_projection",
    priority: 90,
    intervalMs: config.businessTasks.pollMs,
    run: pollBusinessTasks,
  })
  .register({
    name: "approval_escalation",
    priority: 85,
    intervalMs: config.approvals.escalationPollMs,
    run: pollApprovals,
  })
  .register({
    name: "notification_outbox",
    priority: 80,
    intervalMs: config.notifications.outboxPollMs,
    run: pollNotifications,
  })
  .register({
    name: "webhook_deliveries",
    priority: 80,
    intervalMs: config.openPlatform.webhookPollMs,
    run: pollWebhooks,
  })
  .register({
    name: "opportunity_refresh",
    priority: 70,
    intervalMs: config.opportunities.refreshPollMs,
    run: pollOpportunities,
  })
  .register({
    name: "opportunity_scoring",
    priority: 65,
    intervalMs: config.scoring.pollMs,
    run: pollScoring,
  })
  .register({
    name: "opportunity_profit",
    priority: 65,
    intervalMs: config.profit.pollMs,
    run: pollProfit,
  })
  .register({
    name: "competitor_monitor",
    priority: 60,
    intervalMs: config.competitorMonitor.pollMs,
    run: pollCompetitors,
  })
  .register({
    name: "sourcing_projection",
    priority: 60,
    intervalMs: config.sourcing.pollMs,
    run: pollSourcing,
  })
  .register({
    name: "trend_projection",
    priority: 55,
    intervalMs: config.trends.projectionPollMs,
    run: pollTrends,
  })
  .register({ name: "ai_analysis", priority: 50, intervalMs: config.ai.pollMs, run: pollAi })
  .register({
    name: "report_exports",
    priority: 45,
    intervalMs: config.reports.pollMs,
    run: pollReports,
  })
  .register({
    name: "automation_rules",
    priority: 40,
    intervalMs: config.automations.pollMs,
    run: pollAutomations,
  })
  .register({
    name: "core_collection_projection",
    priority: 35,
    intervalMs: 2000,
    run: pollCoreProjection,
  })
  .register({
    name: "automatic_hotspot_sources",
    priority: 30,
    intervalMs: config.automaticSources.pollMs,
    run: pollAutomaticSources,
  });

scheduler.start();
heartbeat();
const heartbeatTimer = setInterval(heartbeat, config.runtime.workerHeartbeatMs);

const stop = async (signal: string) => {
  if (stopping) return;
  stopping = true;
  clearInterval(heartbeatTimer);
  await scheduler?.stop();
  await persistSchedulerState();
  while (
    authPolling ||
    collectionPolling ||
    trendPolling ||
    opportunityPolling ||
    scoringPolling ||
    profitPolling ||
    competitorPolling ||
    sourcingPolling ||
    aiPolling ||
    businessTaskPolling ||
    approvalPolling ||
    notificationPolling ||
    automationPolling ||
    reportPolling ||
    webhookPolling ||
    automaticSourcePolling ||
    coreProjectionPolling
  )
    await new Promise((resolve) => setTimeout(resolve, 25));
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
