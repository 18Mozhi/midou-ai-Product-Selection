import { loadRuntimeConfig } from '@scoutops/config';
import { createDatabasePool } from '@scoutops/database';
import { PendingMailProvider, processAuthDeliveryOnce } from './auth-delivery-worker.js';

const config=loadRuntimeConfig(process.env,'worker');let stopping=false;let polling=false;const pool=config.security.credentialsMasterKey?createDatabasePool(config):null;
const heartbeat=()=>console.log(JSON.stringify({service:'product-scout-worker',status:stopping?'stopping':pool?'idle':'blocked_config',worker_id:config.identity.workerId,config_fingerprint:config.configFingerprint,observed_at:new Date().toISOString()}));
const poll=async()=>{if(stopping||polling||!pool)return;polling=true;try{const result=await processAuthDeliveryOnce({pool,workerId:config.identity.workerId,masterKey:config.security.credentialsMasterKey,provider:new PendingMailProvider()});if(result.status!=='idle')console.log(JSON.stringify({service:'product-scout-worker',queue:'auth_delivery',...result,observed_at:new Date().toISOString()}));}catch{console.error(JSON.stringify({service:'product-scout-worker',queue:'auth_delivery',status:'dependency_failed',observed_at:new Date().toISOString()}));}finally{polling=false;}};
heartbeat();const heartbeatTimer=setInterval(heartbeat,config.runtime.workerHeartbeatMs);const pollTimer=setInterval(()=>void poll(),config.auth.outboxPollMs);void poll();
const stop=async(signal:string)=>{if(stopping)return;stopping=true;clearInterval(heartbeatTimer);clearInterval(pollTimer);while(polling)await new Promise(resolve=>setTimeout(resolve,25));if(pool)await pool.end();console.log(JSON.stringify({service:'product-scout-worker',status:'stopped',signal,worker_id:config.identity.workerId,observed_at:new Date().toISOString()}));};
process.once('SIGTERM',()=>void stop('SIGTERM'));process.once('SIGINT',()=>void stop('SIGINT'));
