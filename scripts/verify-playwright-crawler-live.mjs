import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { loadRuntimeConfig } from '../packages/config/dist/index.js';
import { createDatabasePool } from '../packages/database/dist/index.js';
import { CrawlerRuntimeService } from '../apps/api/dist/crawler-runtime-service.js';
import { MySqlCrawlerRuntimeRepository } from '../apps/api/dist/mysql-crawler-runtime-repository.js';

const requestId=randomUUID(),traceId=requestId;
const ids={actorId:randomUUID(),organizationId:randomUUID(),workspaceId:randomUUID(),providerId:randomUUID(),assetId:randomUUID(),profileId:randomUUID()};
const pool=createDatabasePool(loadRuntimeConfig(process.env,'api'));
let now=new Date('2026-08-07T20:00:00.000Z');

async function ensure(path){
  const sql=await readFile(path,'utf8');
  for(const statement of sql.split(';').map(value=>value.trim()).filter(Boolean)){
    const table=statement.match(/^CREATE TABLE `([^`]+)`/)?.[1];
    if(!table)throw new Error('unexpected migration statement');
    const[rows]=await pool.query('SELECT COUNT(*) count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?',[table]);
    if(Number(rows[0].count)===0)await pool.query(statement);
  }
}
async function cleanup(){
  const targets=[
    ['DELETE FROM crawler_profile_lease_events WHERE actor_id=?',ids.actorId],
    ['DELETE FROM crawler_browser_run_operations WHERE actor_id=?',ids.actorId],
    ['DELETE FROM crawler_runtime_operations WHERE actor_id=?',ids.actorId],
    ['DELETE FROM crawler_profile_leases WHERE crawler_profile_id=?',ids.profileId],
    ['DELETE FROM crawler_browser_runs WHERE crawler_profile_id=?',ids.profileId],
    ['DELETE FROM crawler_profiles WHERE id=?',ids.profileId],
    ['DELETE FROM credential_assets WHERE id=?',ids.assetId],
    ['DELETE FROM providers WHERE id=?',ids.providerId],
    ['DELETE FROM workspaces WHERE id=?',ids.workspaceId],
    ['DELETE FROM organizations WHERE id=?',ids.organizationId],
    ['DELETE FROM users WHERE id=?',ids.actorId],
  ];
  for(const[statement,value]of targets)try{await pool.query(statement,[value]);}catch{}
}
async function assertReject(action,code){try{await action();throw new Error(`expected ${code}`);}catch(error){if(error?.code!==code)throw error;}}

try{
  const[vr]=await pool.query('SELECT VERSION() version,@@character_set_server charset,DATABASE() database_name,CURRENT_USER() account_name'),runtime=vr[0];
  if(!String(runtime.version).startsWith('5.7.')||runtime.charset!=='utf8mb4'||runtime.database_name!=='product_scout'||!String(runtime.account_name).startsWith('product_scout@'))throw new Error('requires MySQL57 utf8mb4 product_scout business account');
  for(const path of['database/migrations/0016a_provider_registry_m03_01.up.sql','database/migrations/0016b_credential_assets_m03_02.up.sql','database/migrations/0016d_playwright_crawler_m03_04.up.sql'])await ensure(path);
  await cleanup();
  const email=`m03-04-${requestId}@example.test`;
  await pool.query("INSERT INTO users (id,email,email_normalized,password_hash,status,email_verified_at,password_changed_at,version,created_at,updated_at) VALUES (?,?,?,'live-probe','active',?,?,1,?,?)",[ids.actorId,email,email,now,now,now,now]);
  await pool.query("INSERT INTO organizations (id,name,slug,status,timezone,data_retention_days,default_workspace_id,created_by,version,created_at,updated_at) VALUES (?,?,?,'active','Asia/Shanghai',365,NULL,?,1,?,?)",[ids.organizationId,'M03-04 组织',`m0304-${requestId.slice(0,8)}`,ids.actorId,now,now]);
  await pool.query("INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version,created_at,updated_at) VALUES (?,?,?,?,'active',?,1,?,?)",[ids.workspaceId,ids.organizationId,'默认工作区','default',ids.actorId,now,now]);
  await pool.query("INSERT INTO providers (id,code,name,target_url,access_mode,markets_json,languages_json,fields_json,schedule_minutes,concurrency_limit,timeout_ms,retry_limit,circuit_failure_threshold,dedupe_key,retention_days,failure_rules_json,parser_version,healthcheck_url,owner_label,status,version,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,'https://example.test','authenticated_browser','[\"US\"]','[\"en-US\"]','[\"title\"]',30,1,30000,2,5,'external_id',30,'[\"rate_limited\"]','v1',NULL,'平台运营','enabled',1,?,?,?,?)",[ids.providerId,`m03_04_${requestId.replaceAll('-','').slice(0,10)}`,'M03-04 Browser',ids.actorId,ids.actorId,now,now]);
  await pool.query("INSERT INTO credential_assets (id,provider_id,name,kind,payload_ciphertext,payload_nonce,payload_auth_tag,key_version,fingerprint,status,expires_at,rotated_at,revoked_at,revoked_by,revocation_reason,version,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,'browser_profile',?,?,?,?,?,'active',NULL,NULL,NULL,NULL,NULL,1,?,?,?,?)",[ids.assetId,ids.providerId,'Live profile archive',randomBytes(32),randomBytes(12),randomBytes(16),'live-v1','0011223344556677',ids.actorId,ids.actorId,now,now]);
  await pool.query("INSERT INTO crawler_profiles (id,provider_id,credential_asset_id,code,name,browser_family,locale,timezone,status,version,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,'chromium','en-US','America/Los_Angeles','active',1,?,?,?,?)",[ids.profileId,ids.providerId,ids.assetId,`profile_${requestId.slice(0,8)}`,'Live Browser Profile',ids.actorId,ids.actorId,now,now]);
  const service=new CrawlerRuntimeService(new MySqlCrawlerRuntimeRepository(pool),()=>now);
  const context={organizationId:ids.organizationId,workspaceId:ids.workspaceId,profileId:ids.profileId,leaseOwner:'crawler-live-1',leaseSeconds:30,actorId:ids.actorId,idempotencyKey:'acquire-1',requestId,traceId};
  const acquired=await service.acquire(context);
  if(!acquired.lease_token||acquired.run.status!=='running')throw new Error('lease acquire failed');
  const replay=await service.acquire(context);
  if(!replay.replayed||replay.lease_token!==null||replay.run.id!==acquired.run.id)throw new Error('idempotency replay exposed or changed token');
  await assertReject(()=>service.acquire({...context,idempotencyKey:'acquire-conflict'}),'crawler_profile_lease_conflict');
  await assertReject(()=>service.heartbeat({runId:acquired.run.id,profileId:ids.profileId,leaseToken:'x'.repeat(72),leaseSeconds:30,actorId:ids.actorId,requestId,traceId}),'crawler_lease_invalid');
  await service.heartbeat({runId:acquired.run.id,profileId:ids.profileId,leaseToken:acquired.lease_token,leaseSeconds:30,actorId:ids.actorId,requestId,traceId});
  await service.finish({runId:acquired.run.id,profileId:ids.profileId,leaseToken:acquired.lease_token,status:'succeeded',pageCount:2,itemCount:4,detailCount:2,durationMs:123,errorCode:null,actorId:ids.actorId,requestId,traceId});
  await service.acquire({...context,idempotencyKey:'acquire-expiring'});
  now=new Date(now.getTime()+31000);
  const recovered=await service.recoverExpired({actorId:ids.actorId,idempotencyKey:'recover-expired-1',requestId,traceId});
  const recoveredReplay=await service.recoverExpired({actorId:ids.actorId,idempotencyKey:'recover-expired-1',requestId,traceId});
  if(recovered.recovered!==1||recoveredReplay.recovered!==1)throw new Error('expired lease recovery idempotency failed');
  const snapshot=await service.list(),profile=snapshot.profiles.find(item=>item.id===ids.profileId),moduleRuns=snapshot.runs.filter(item=>item.crawler_profile_id===ids.profileId);
  if(profile?.lease!==null||moduleRuns.length!==2||moduleRuns.some(item=>item.organization_id!==ids.organizationId||item.workspace_id!==ids.workspaceId)||!moduleRuns.some(item=>item.status==='timed_out')||!moduleRuns.some(item=>item.status==='succeeded'))throw new Error('scoped runtime snapshot mismatch');
  const[events]=await pool.query('SELECT action,request_id,trace_id FROM crawler_profile_lease_events WHERE crawler_profile_id=? ORDER BY occurred_at,id',[ids.profileId]);
  if(!['acquired','heartbeat','released','recovered'].every(action=>events.some(row=>row.action===action))||events.some(row=>row.request_id!==requestId||row.trace_id!==traceId))throw new Error('lease audit correlation mismatch');
  await cleanup();
  console.log(JSON.stringify({status:'passed',module:'M03-04',mysql:runtime.version,exclusive_lease:'passed',idempotent_replay:'passed',heartbeat_token_guard:'passed',expired_recovery:'passed',scope:'organization_workspace',audit_events:events.length,cleanup:'passed',request_id:requestId,trace_id:traceId}));
}catch(error){console.error(JSON.stringify({status:'blocked',code:error?.code??'playwright_crawler_live_failed',message:error instanceof Error?error.message:'unknown',request_id:requestId,trace_id:traceId}));process.exitCode=2;}finally{await cleanup();await pool.end();}
