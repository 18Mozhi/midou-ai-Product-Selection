import type { PasswordHasher } from "@scoutops/auth";
import { CollectionConsoleService } from "../collection-console-service.js";
import { registerCollectionConsoleRoutes } from "../collection-console-routes.js";
import { CommercialService } from "../commercial-service.js";
import { registerCommercialRoutes } from "../commercial-routes.js";
import { MySqlCollectionConsoleRepository } from "../mysql-collection-console-repository.js";
import { MySqlCommercialRepository } from "../mysql-commercial-repository.js";
import { MySqlOpenPlatformRepository } from "../mysql-open-platform-repository.js";
import { MySqlPlatformAccountRepository } from "../mysql-platform-account-repository.js";
import { MySqlPlatformDashboardRepository } from "../mysql-platform-dashboard-repository.js";
import { MySqlSecurityOperationsRepository } from "../mysql-security-operations-repository.js";
import { OpenPlatformService } from "../open-platform-service.js";
import { registerOpenPlatformRoutes } from "../open-platform-routes.js";
import { PlatformAccountService } from "../platform-account-service.js";
import { registerPlatformAccountRoutes } from "../platform-account-routes.js";
import { PlatformDashboardService } from "../platform-dashboard-service.js";
import { registerPlatformDashboardRoutes } from "../platform-dashboard-routes.js";
import { SecurityOperationsService } from "../security-operations-service.js";
import { registerSecurityOperationsRoutes } from "../security-operations-routes.js";
import { commonDomainOptions, type ApiDomainContext } from "./domain-context.js";

interface PlatformDomainContext extends ApiDomainContext {
  passwordHasher: PasswordHasher;
}

export function registerPlatformDomainRoutes(context: PlatformDomainContext) {
  const common = commonDomainOptions(context);
  registerPlatformDashboardRoutes(context.app, {
    service: new PlatformDashboardService(
      new MySqlPlatformDashboardRepository(
        context.pool,
        context.config.platformDashboard.queueWarning,
        context.config.platformDashboard.errorLimit,
      ),
      context.config.platformDashboard.defaultWindow,
    ),
    ...common,
  });
  registerPlatformAccountRoutes(context.app, {
    service: new PlatformAccountService(
      new MySqlPlatformAccountRepository(context.pool),
      () => new Date(),
      context.passwordHasher,
      context.config.auth.passwordMinLength,
      context.config.auth.passwordMaxLength,
    ),
    ...common,
  });
  registerCollectionConsoleRoutes(context.app, {
    service: new CollectionConsoleService(
      new MySqlCollectionConsoleRepository(context.pool),
      context.config.collectionConsole.recentLimit,
    ),
    authorization: context.authorization,
    auth: context.auth,
    secureCookie: context.secureCookie,
  });
  registerSecurityOperationsRoutes(context.app, {
    service: new SecurityOperationsService(
      new MySqlSecurityOperationsRepository(context.pool),
      context.config.securityOperations.defaultWindow,
      context.config.securityOperations.recentLimit,
    ),
    authorization: context.authorization,
    auth: context.auth,
    secureCookie: context.secureCookie,
  });
  registerOpenPlatformRoutes(context.app, {
    service: new OpenPlatformService(
      new MySqlOpenPlatformRepository(context.pool),
      context.config.security.credentialsMasterKey,
      context.config.security.credentialsMasterKeyVersion,
      {
        clientTtlDays: context.config.openPlatform.clientTtlDays,
        defaultQuota: context.config.openPlatform.defaultQuotaPerMinute,
        maxQuota: context.config.openPlatform.maxQuotaPerMinute,
        timestampToleranceSeconds: context.config.openPlatform.timestampToleranceSeconds,
        nonceTtlSeconds: context.config.openPlatform.nonceTtlSeconds,
      },
    ),
    ...common,
    version: context.config.app.version,
  });
  registerCommercialRoutes(context.app, {
    service: new CommercialService(
      new MySqlCommercialRepository(context.pool),
      context.config.commercial.recentLimit,
    ),
    ...common,
  });
}
