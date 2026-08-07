import { loadRuntimeConfig } from '@scoutops/config';

const config=loadRuntimeConfig(process.env,'worker');let stopping=false;
const heartbeat=()=>console.log(JSON.stringify({service:'product-scout-worker',status:stopping?'stopping':'idle',worker_id:config.identity.workerId,config_fingerprint:config.configFingerprint,observed_at:new Date().toISOString()}));
heartbeat();const timer=setInterval(heartbeat,config.runtime.workerHeartbeatMs);
const stop=(signal:string)=>{if(stopping)return;stopping=true;clearInterval(timer);console.log(JSON.stringify({service:'product-scout-worker',status:'stopped',signal,worker_id:config.identity.workerId,observed_at:new Date().toISOString()}));};
process.once('SIGTERM',()=>stop('SIGTERM'));process.once('SIGINT',()=>stop('SIGINT'));
