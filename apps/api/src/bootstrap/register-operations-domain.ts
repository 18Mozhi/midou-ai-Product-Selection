import { BackupRecoveryService } from "../backup-recovery-service.js";
import { registerBackupRecoveryRoutes } from "../backup-recovery-routes.js";
import { DataQualityService } from "../data-quality-service.js";
import { registerDataQualityRoutes } from "../data-quality-routes.js";
import { MySqlBackupRecoveryRepository } from "../mysql-backup-recovery-repository.js";
import { MySqlDataQualityRepository } from "../mysql-data-quality-repository.js";
import { MySqlReleaseRolloutRepository } from "../mysql-release-rollout-repository.js";
import { registerCapacityBoundaryRoutes } from "../capacity-boundary-routes.js";
import type { CapacityBoundaryService } from "../capacity-boundary-service.js";
import { registerCrawlerSchedulerRoutes } from "../crawler-scheduler-routes.js";
import type { CrawlerSchedulerService } from "../crawler-scheduler-service.js";
import { registerFileResilienceRoutes } from "../file-resilience-routes.js";
import type { FileResilienceService } from "../file-resilience-service.js";
import { registerMySqlResilienceRoutes } from "../mysql-resilience-routes.js";
import type { MySqlResilienceService } from "../mysql-resilience-service.js";
import { registerRedisResilienceRoutes } from "../redis-resilience-routes.js";
import type { RedisResilienceService } from "../redis-resilience-service.js";
import {
  ReleaseRolloutService,
  ReleaseWriteProbeService,
} from "../release-rollout-service.js";
import { registerReleaseRolloutRoutes } from "../release-rollout-routes.js";
import { registerRuntimeTopologyRoutes } from "../runtime-topology-routes.js";
import type { RuntimeTopologyService } from "../runtime-topology-service.js";
import {
  commonDomainOptions,
  type ApiDomainContext,
} from "./domain-context.js";

interface OperationsDomainContext extends ApiDomainContext {
  runtimeTopologyService: RuntimeTopologyService;
  redisResilienceService: RedisResilienceService;
  mysqlResilienceService: MySqlResilienceService;
  fileResilienceService: FileResilienceService;
  crawlerSchedulerService: CrawlerSchedulerService;
  capacityBoundaryService: CapacityBoundaryService;
}

export function registerOperationsDomainRoutes(
  context: OperationsDomainContext,
) {
  const common = commonDomainOptions(context);
  registerBackupRecoveryRoutes(context.app, {
    service: new BackupRecoveryService(
      new MySqlBackupRecoveryRepository(context.pool),
      context.config.backupRecovery,
    ),
    authorization: context.authorization,
    auth: context.auth,
    secureCookie: context.secureCookie,
  });
  const releaseRolloutRepository = new MySqlReleaseRolloutRepository(
    context.pool,
  );
  registerReleaseRolloutRoutes(context.app, {
    service: new ReleaseRolloutService(releaseRolloutRepository, {
      percentages: [5, 25, 100],
      ...context.config.releaseRollout,
    }),
    writeProbeService: new ReleaseWriteProbeService(
      releaseRolloutRepository,
      context.config.security.releaseProbeSigningKey,
      context.config.app.buildSha,
      context.config.releaseRollout.probeTimestampToleranceSeconds,
    ),
    authorization: context.authorization,
    auth: context.auth,
    secureCookie: context.secureCookie,
  });
  registerRuntimeTopologyRoutes(context.app, {
    service: context.runtimeTopologyService,
    authorization: context.authorization,
    auth: context.auth,
    secureCookie: context.secureCookie,
  });
  registerRedisResilienceRoutes(context.app, {
    service: context.redisResilienceService,
    authorization: context.authorization,
    auth: context.auth,
    secureCookie: context.secureCookie,
  });
  registerMySqlResilienceRoutes(context.app, {
    service: context.mysqlResilienceService,
    authorization: context.authorization,
    auth: context.auth,
    secureCookie: context.secureCookie,
  });
  registerFileResilienceRoutes(context.app, {
    service: context.fileResilienceService,
    authorization: context.authorization,
    auth: context.auth,
    secureCookie: context.secureCookie,
  });
  registerCrawlerSchedulerRoutes(context.app, {
    service: context.crawlerSchedulerService,
    ...common,
  });
  registerCapacityBoundaryRoutes(context.app, {
    service: context.capacityBoundaryService,
    ...common,
  });
  registerDataQualityRoutes(context.app, {
    service: new DataQualityService(
      new MySqlDataQualityRepository(context.pool),
      {
        evidenceRoot: context.config.storage.evidenceRoot,
        downloadSigningKey:
          context.config.security.evidenceDownloadSigningKey,
        downloadGrantSeconds: context.config.evidence.downloadGrantSeconds,
      },
    ),
    ...common,
  });
}
