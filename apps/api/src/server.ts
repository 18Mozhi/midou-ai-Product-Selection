import { buildApp } from './app.js';
import { loadRuntimeConfig } from '@scoutops/config';
import { createDatabasePool } from '@scoutops/database';
import { createRedisConnection, ScopedRedisStore } from '@scoutops/redis';
import { createArgon2PasswordHasher, EncryptedOutboxAuthDelivery, LocalAuthService, MfaService, PendingAuthDelivery } from '@scoutops/auth';
import { MySqlAuthRepository } from './mysql-auth-repository.js';
import { MySqlAuthOutboxStore } from './mysql-auth-outbox.js';
import { MySqlAuthIdempotency } from './mysql-auth-idempotency.js';
import { MySqlMfaRepository } from './mysql-mfa-repository.js';
import { TenancyService } from '@scoutops/tenancy';
import { MySqlTenancyRepository } from './mysql-tenancy-repository.js';
import { AuthorizationService } from '@scoutops/authorization';
import { MySqlAuthorizationRepository } from './mysql-authorization-repository.js';
import { ResourceGrantService } from '@scoutops/resource-grants';
import { MySqlResourceGrantRepository } from './mysql-resource-grant-repository.js';
import { AuditQueryService } from '@scoutops/audit';
import { MySqlAuditRepository } from './mysql-audit-repository.js';
import { UiPreferenceService } from '@scoutops/preferences';
import { MySqlUiPreferenceRepository } from './mysql-ui-preference-repository.js';
import { DiscoveryService } from './discovery-service.js';
import { MySqlDiscoveryRepository } from './mysql-discovery-repository.js';
import { HomeDashboardService } from './home-dashboard-service.js';
import { MySqlHomeDashboardRepository } from './mysql-home-dashboard-repository.js';
import { ProviderRegistryService } from './provider-registry-service.js';
import { MySqlProviderRegistryRepository } from './mysql-provider-registry-repository.js';
import { CredentialAssetService } from './credential-asset-service.js';
import { MySqlCredentialAssetRepository } from './mysql-credential-asset-repository.js';
import { ProviderAdapterRegistry } from '@scoutops/provider-adapters';
import { ProviderAdapterService } from './provider-adapter-service.js';
import { MySqlProviderAdapterRepository } from './mysql-provider-adapter-repository.js';
import { CrawlerRuntimeService } from './crawler-runtime-service.js';
import { MySqlCrawlerRuntimeRepository } from './mysql-crawler-runtime-repository.js';

const config = loadRuntimeConfig(process.env, 'api');
const pool=createDatabasePool(config);const redisClient=createRedisConnection(config);redisClient.on('error',()=>{});const redisStore=new ScopedRedisStore(redisClient);
const authRepository=new MySqlAuthRepository(pool);const authOutbox=new MySqlAuthOutboxStore(pool);const authDelivery=config.security.credentialsMasterKey?new EncryptedOutboxAuthDelivery(authOutbox,config.security.credentialsMasterKey):new PendingAuthDelivery();
const passwordHasher=createArgon2PasswordHasher({memoryCost:config.auth.argon2MemoryKib,timeCost:config.auth.argon2TimeCost,parallelism:config.auth.argon2Parallelism});const mfaRepository=new MySqlMfaRepository(pool);let localAuth:LocalAuthService;
const mfa=new MfaService({repository:mfaRepository,authRepository,passwordHasher,masterKey:config.security.credentialsMasterKey,policy:{issuer:config.mfa.issuer,periodSeconds:config.mfa.totpPeriodSeconds,digits:config.mfa.totpDigits,window:config.mfa.totpWindow,challengeTtlMinutes:config.mfa.challengeTtlMinutes,maxAttempts:config.mfa.maxAttempts,recoveryCodeCount:config.mfa.recoveryCodeCount},completeLogin:(userId,context)=>localAuth.completeSecondFactorLogin(userId,context),completeEnrollment:(userId)=>localAuth.completeMfaEnrollment(userId)});
localAuth=new LocalAuthService({repository:authRepository,delivery:authDelivery,passwordHasher,secondFactorGate:mfa,policy:{passwordMinLength:config.auth.passwordMinLength,passwordMaxLength:config.auth.passwordMaxLength,sessionTtlMinutes:config.auth.sessionTtlMinutes,actionTokenTtlMinutes:config.auth.actionTokenTtlMinutes,maxFailedAttempts:config.auth.maxFailedAttempts,lockMinutes:config.auth.lockMinutes}});
const idempotency=new MySqlAuthIdempotency(pool);const resourceGrants=new ResourceGrantService(new MySqlResourceGrantRepository(pool));const authorization=new AuthorizationService(new MySqlAuthorizationRepository(pool),undefined,resourceGrants);const audit=new AuditQueryService(new MySqlAuditRepository(pool));const app = buildApp({ logger: true, version: config.app.version, buildSha: config.app.buildSha, configFingerprint: config.configFingerprint, readinessChecks:[
  {name:'mysql',check:async()=>{try{await pool.query('SELECT 1');return 'available';}catch{return 'unavailable';}}},
  {name:'redis',check:async(requestId,traceId)=>{try{await redisStore.connect();return (await redisStore.health(requestId,traceId)).status;}catch{return 'unavailable';}}},
],localAuth:{service:localAuth,mfa,idempotency,webOrigin:config.app.webOrigin,secureCookie:config.nodeEnv==='production'},tenancy:{service:new TenancyService(new MySqlTenancyRepository(pool)),auth:localAuth,idempotency,webOrigin:config.app.webOrigin,secureCookie:config.nodeEnv==='production'},authorization:{service:authorization,auth:localAuth,secureCookie:config.nodeEnv==='production'},resourceGrants:{service:resourceGrants,authorization,auth:localAuth,secureCookie:config.nodeEnv==='production'},audit:{service:audit,authorization,auth:localAuth,secureCookie:config.nodeEnv==='production'},uiPreferences:{service:new UiPreferenceService(new MySqlUiPreferenceRepository(pool)),auth:localAuth,webOrigin:config.app.webOrigin,secureCookie:config.nodeEnv==='production'},discovery:{service:new DiscoveryService(new MySqlDiscoveryRepository(pool)),authorization,auth:localAuth,secureCookie:config.nodeEnv==='production'},homeDashboard:{service:new HomeDashboardService(new MySqlHomeDashboardRepository(pool)),authorization,auth:localAuth,secureCookie:config.nodeEnv==='production'},providerRegistry:{service:new ProviderRegistryService(new MySqlProviderRegistryRepository(pool)),authorization,auth:localAuth,secureCookie:config.nodeEnv==='production',webOrigin:config.app.webOrigin},credentialAssets:{service:new CredentialAssetService(new MySqlCredentialAssetRepository(pool),config.security.credentialsMasterKey,config.security.credentialsMasterKeyVersion),authorization,auth:localAuth,secureCookie:config.nodeEnv==='production',webOrigin:config.app.webOrigin},providerAdapters:{service:new ProviderAdapterService(new MySqlProviderAdapterRepository(pool),new ProviderAdapterRegistry({healthTimeoutMs:config.providerAdapters.healthTimeoutMs,maxResponseBytes:config.providerAdapters.maxResponseBytes,maxItemsPerBatch:config.providerAdapters.maxItemsPerBatch})),authorization,auth:localAuth,secureCookie:config.nodeEnv==='production',webOrigin:config.app.webOrigin},crawlerRuntime:{service:new CrawlerRuntimeService(new MySqlCrawlerRuntimeRepository(pool)),authorization,auth:localAuth,secureCookie:config.nodeEnv==='production',webOrigin:config.app.webOrigin} });
app.addHook('onClose',async()=>{await redisStore.close();await pool.end();});
const { host, port } = config.app;

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error({ error }, 'API startup failed');
  process.exitCode = 1;
}
