import { buildApp } from './app.js';
import { loadRuntimeConfig } from '@scoutops/config';
import { createDatabasePool } from '@scoutops/database';
import { createRedisConnection, ScopedRedisStore } from '@scoutops/redis';
import { createArgon2PasswordHasher, EncryptedOutboxAuthDelivery, LocalAuthService, PendingAuthDelivery } from '@scoutops/auth';
import { MySqlAuthRepository } from './mysql-auth-repository.js';
import { MySqlAuthOutboxStore } from './mysql-auth-outbox.js';
import { MySqlAuthIdempotency } from './mysql-auth-idempotency.js';

const config = loadRuntimeConfig(process.env, 'api');
const pool=createDatabasePool(config);const redisClient=createRedisConnection(config);redisClient.on('error',()=>{});const redisStore=new ScopedRedisStore(redisClient);
const authRepository=new MySqlAuthRepository(pool);const authOutbox=new MySqlAuthOutboxStore(pool);const authDelivery=config.security.credentialsMasterKey?new EncryptedOutboxAuthDelivery(authOutbox,config.security.credentialsMasterKey):new PendingAuthDelivery();
const localAuth=new LocalAuthService({repository:authRepository,delivery:authDelivery,passwordHasher:createArgon2PasswordHasher({memoryCost:config.auth.argon2MemoryKib,timeCost:config.auth.argon2TimeCost,parallelism:config.auth.argon2Parallelism}),policy:{passwordMinLength:config.auth.passwordMinLength,passwordMaxLength:config.auth.passwordMaxLength,sessionTtlMinutes:config.auth.sessionTtlMinutes,actionTokenTtlMinutes:config.auth.actionTokenTtlMinutes,maxFailedAttempts:config.auth.maxFailedAttempts,lockMinutes:config.auth.lockMinutes}});
const app = buildApp({ logger: true, version: config.app.version, buildSha: config.app.buildSha, configFingerprint: config.configFingerprint, readinessChecks:[
  {name:'mysql',check:async()=>{try{await pool.query('SELECT 1');return 'available';}catch{return 'unavailable';}}},
  {name:'redis',check:async(requestId,traceId)=>{try{await redisStore.connect();return (await redisStore.health(requestId,traceId)).status;}catch{return 'unavailable';}}},
],localAuth:{service:localAuth,idempotency:new MySqlAuthIdempotency(pool),webOrigin:config.app.webOrigin,secureCookie:config.nodeEnv==='production'} });
app.addHook('onClose',async()=>{await redisStore.close();await pool.end();});
const { host, port } = config.app;

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error({ error }, 'API startup failed');
  process.exitCode = 1;
}
