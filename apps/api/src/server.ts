import { buildApp } from './app.js';
import { loadRuntimeConfig } from '@scoutops/config';
import { createDatabasePool } from '@scoutops/database';
import { createRedisConnection, ScopedRedisStore } from '@scoutops/redis';

const config = loadRuntimeConfig(process.env, 'api');
const pool=createDatabasePool(config);const redisClient=createRedisConnection(config);redisClient.on('error',()=>{});const redisStore=new ScopedRedisStore(redisClient);
const app = buildApp({ logger: true, version: config.app.version, buildSha: config.app.buildSha, configFingerprint: config.configFingerprint, readinessChecks:[
  {name:'mysql',check:async()=>{try{await pool.query('SELECT 1');return 'available';}catch{return 'unavailable';}}},
  {name:'redis',check:async(requestId,traceId)=>{try{await redisStore.connect();return (await redisStore.health(requestId,traceId)).status;}catch{return 'unavailable';}}},
] });
app.addHook('onClose',async()=>{await redisStore.close();await pool.end();});
const { host, port } = config.app;

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error({ error }, 'API startup failed');
  process.exitCode = 1;
}
