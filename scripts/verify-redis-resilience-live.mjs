import {randomUUID} from "node:crypto";
import {loadRuntimeConfig} from "../packages/config/dist/index.js";
import {createRedisConnection,evaluateRedisResilience,inspectRedisResilience,ScopedRedisStore} from "../packages/redis/dist/index.js";

const config=loadRuntimeConfig(process.env,"api"),client=createRedisConnection(config),store=new ScopedRedisStore(client),runId=randomUUID();
client.on("error",()=>{});
const key={purpose:"cache",organization_id:`verify-${runId}`,workspace_id:"m08-02",resource:"recovery"};
try{
  await store.connect();
  const snapshot=await inspectRedisResilience(client),evaluation=evaluateRedisResilience(snapshot,config.redisResilience);
  if(evaluation.state!=="ready")throw new Error(`redis resilience ${evaluation.state}: ${evaluation.findings.map((item)=>item.code).join(",")}`);
  await store.writeJson(key,{run_id:runId},30);
  if((await store.readJson(key))?.run_id!==runId)throw new Error("scoped recovery round trip failed");
  await store.delete(key);
  console.log(JSON.stringify({module:"M08-02",status:"passed",mode:"single_instance",appendonly:snapshot.appendOnlyEnabled,rdb:snapshot.rdbEnabled,maxmemory_bytes:snapshot.maxMemoryBytes,maxclients:snapshot.maxClients,memory_usage_basis_points:evaluation.memoryUsageBasisPoints,connection_usage_basis_points:evaluation.connectionUsageBasisPoints,cleanup:"passed",capacity_claim:"unverified",request_id:runId,trace_id:runId}));
}catch(error){console.error(JSON.stringify({module:"M08-02",status:"blocked",code:"redis_resilience_live_failed",message:error instanceof Error?error.message:"unknown",request_id:runId,trace_id:runId}));process.exitCode=2;}finally{try{await store.delete(key);}catch{}await store.close();}
