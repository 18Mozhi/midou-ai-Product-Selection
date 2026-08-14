import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const requiredFiles = [
  "database/migrations/0032_mysql_resilience_m08_03.up.sql",
  "database/migrations/0032_mysql_resilience_m08_03.down.sql",
  "apps/api/src/mysql-resilience-probe.ts",
  "apps/api/src/mysql-resilience-service.ts",
  "apps/api/src/mysql-resilience-repository.ts",
  "apps/api/src/mysql-resilience-routes.ts",
  "apps/web/src/components/MySqlResilienceCenter.vue",
  "apps/web/src/mysql-resilience.css",
  "infra/baota/mysql-single-primary-manifest.json",
  "verification/mysql-resilience-production-evidence.schema.json",
  "scripts/verify-mysql-resilience-production.mjs",
  "docs/architecture/m08-03-mysql-resilience.md",
  "docs/runbooks/m08-03-mysql-resilience.md",
  "tests/e2e/m08-03-mysql-resilience.spec.ts",
  "verification/modules/M08-03.json",
];

test("M08-03.A01-A17 deliver a BaoTa-only MySQL57 single-primary resilience boundary", async () => {
  const all = (await Promise.all(requiredFiles.map((path) => readFile(path, "utf8")))).join("\n");
  for (const token of ["M08-03", "single_primary", "MySQL 5.7", "slow", "capacity", "platform:operate", "request_id", "trace_id", "rollback", "baota"]) {
    assert.match(all, new RegExp(token, "i"));
  }
  assert.doesNotMatch(all, /CHANGE\s+MASTER|START\s+SLAVE|read[_ -]?replica|systemctl\s|pm2\s+start|docker(?:-|\s)compose\s+up/i);
});

test("M08-03.A02/A04/A12 evaluates durability I/O slow query capacity and recovery facts", async () => {
  const { evaluateMySqlResilience } = await import("../../packages/database/dist/index.js");
  const policy = {
    connectionWarningBasisPoints: 7500,
    connectionStopBasisPoints: 9000,
    dataWarningBasisPoints: 7500,
    dataStopBasisPoints: 9000,
    slowQueryWarningPerMinute: 5,
    slowQueryStopPerMinute: 20,
    bufferPoolHitWarningBasisPoints: 9900,
    maximumRecoveryDrillAgeDays: 90,
    maximumRpoMinutes: 15,
    maximumRtoMinutes: 240,
  };
  const base = {
    available: true,
    version: "5.7.44-log",
    readOnly: false,
    logBinEnabled: true,
    binlogFormat: "ROW",
    productDatabaseBinlogExcluded: false,
    innodbFlushLogAtTrxCommit: 2,
    syncBinlog: 1,
    masterStatusAvailable: true,
    replicaConfigured: false,
    bufferPoolBytes: 4_294_967_296,
    bufferPoolDataBytes: 2_147_483_648,
    bufferPoolHitRateBasisPoints: 9999,
    maxConnections: 512,
    threadsConnected: 20,
    threadsRunning: 2,
    slowQueriesPerMinute: 0,
    longQueryTimeSeconds: 2,
    dataFilesystemTotalBytes: 1000,
    dataFilesystemAvailableBytes: 600,
    innodbLogWaits: 0,
    innodbRowLockWaits: 0,
    uptimeSeconds: 3600,
    backupStatus: "verified",
    actualRpoMinutes: 1,
    actualRtoMinutes: 3,
    recoveryDrillAgeDays: 1,
  };
  const ready = evaluateMySqlResilience(base, policy);
  assert.equal(ready.state, "ready");
  assert.equal(ready.connectionUsageBasisPoints, 391);
  assert.equal(ready.dataUsageBasisPoints, 4000);
  assert.equal(ready.singlePrimary, true);
  assert.equal(ready.replicaEnabled, false);
  assert.equal(ready.capacityClaim, "unverified");

  const warning = evaluateMySqlResilience({...base, slowQueriesPerMinute: 5}, policy);
  assert.equal(warning.state, "warning");
  assert.ok(warning.findings.some((item) => item.code === "mysql_slow_query_warning"));

  const blocked = evaluateMySqlResilience({...base, logBinEnabled: false, backupStatus: "stale"}, policy);
  assert.equal(blocked.state, "blocked");
  assert.ok(blocked.findings.some((item) => item.code === "mysql_binlog_disabled"));
  assert.ok(blocked.findings.some((item) => item.code === "mysql_recovery_stale"));
});

test("M08-03.A06/A09/A11/A13 operations route is authorized audited and sanitized", async () => {
  const { buildApp } = await import("../../apps/api/dist/app.js");
  const calls = [];
  const service = { read: async (input) => { calls.push(["read", input]); return {state:"ready",mode:"single_primary",durability:{log_bin_enabled:true,binlog_format:"ROW",innodb_flush_log_at_trx_commit:2,sync_binlog:1},connections:{connected:2,running:1,maximum:512,usage_basis_points:39},storage:{used_bytes:400,total_bytes:1000,usage_basis_points:4000},io:{buffer_pool_bytes:1000,buffer_pool_data_bytes:500,buffer_pool_hit_rate_basis_points:9999,innodb_log_waits:0,innodb_row_lock_waits:0},slow_queries:{per_minute:0,long_query_time_seconds:2},recovery:{status:"verified",actual_rpo_minutes:1,actual_rto_minutes:3,drill_age_days:1},findings:[],single_primary:true,replica_enabled:false,backup_server_used:false,capacity_claim:"unverified",observed_at:"2026-08-14T13:00:00.000Z"}; } };
  const authorization = { authorize: async (input) => calls.push(["authorize", input]) };
  const auth = { authenticate: async () => ({user:{id:"00000000-0000-4000-8000-000000000803"},session:{id:"session"}}) };
  const app = buildApp({mysqlResilience:{service, authorization, auth, secureCookie:false}});
  const response = await app.inject({method:"GET",url:"/api/v1/platform/operations/mysql",headers:{cookie:"scoutops_session=test","x-request-id":"mysql-request","x-trace-id":"mysql-trace"}});
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.equal(calls[0][1].capability, "platform:operate");
  assert.equal(calls[1][1].requestId, "mysql-request");
  assert.doesNotMatch(response.body, /DB_PASSWORD|mysql:\/\/|127\.0\.0\.1|3306|\/www\/server|product_scout@/i);
  await app.close();
});

test("M08-03.A03/A10/A14 migration and configuration remain MySQL57 and backend-only", async () => {
  const [{loadRuntimeConfig}, up, down, schema, env] = await Promise.all([
    import("../../packages/config/dist/index.js"),
    readFile("database/migrations/0032_mysql_resilience_m08_03.up.sql", "utf8"),
    readFile("database/migrations/0032_mysql_resilience_m08_03.down.sql", "utf8"),
    readFile("config/schema.json", "utf8"),
    readFile("config/env.example", "utf8"),
  ]);
  assert.match(up, /utf8mb4/); assert.doesNotMatch(up, /CHECK\s*\(|utf8mb4_0900|INVISIBLE\s+INDEX/i); assert.match(down, /DROP TABLE/);
  const config = loadRuntimeConfig({NODE_ENV:"test",MYSQL_CONNECTION_WARNING_PERCENT:"70",MYSQL_CONNECTION_STOP_PERCENT:"85",MYSQL_DATA_WARNING_PERCENT:"65",MYSQL_DATA_STOP_PERCENT:"90",MYSQL_SLOW_QUERY_WARNING_PER_MINUTE:"4",MYSQL_SLOW_QUERY_STOP_PER_MINUTE:"16"}, "api");
  assert.equal(config.mysqlResilience.connectionWarningBasisPoints, 7000);
  assert.equal(config.mysqlResilience.connectionStopBasisPoints, 8500);
  assert.equal(config.mysqlResilience.dataWarningBasisPoints, 6500);
  assert.equal(config.mysqlResilience.dataStopBasisPoints, 9000);
  assert.equal(config.mysqlResilience.slowQueryWarningPerMinute, 4);
  assert.equal(config.mysqlResilience.slowQueryStopPerMinute, 16);
  assert.throws(() => loadRuntimeConfig({MYSQL_DATA_WARNING_PERCENT:"90",MYSQL_DATA_STOP_PERCENT:"80"}, "api"), /MYSQL_DATA/);
  for (const key of ["MYSQL_CONNECTION_WARNING_PERCENT","MYSQL_CONNECTION_STOP_PERCENT","MYSQL_DATA_WARNING_PERCENT","MYSQL_DATA_STOP_PERCENT","MYSQL_SLOW_QUERY_WARNING_PER_MINUTE","MYSQL_SLOW_QUERY_STOP_PER_MINUTE","MYSQL_RESILIENCE_PRODUCTION_EVIDENCE_FILE","MYSQL_RESILIENCE_EVIDENCE_MAX_AGE_MINUTES"]) {
    assert.match(schema, new RegExp(key)); assert.match(env, new RegExp(key));
  }
});

test("M08-03.A04/A09/A14 persists observation view and audit in one transaction", async () => {
  const {MySqlResilienceRepository}=await import("../../apps/api/dist/mysql-resilience-repository.js");
  const calls=[];
  const connection={beginTransaction:async()=>calls.push("begin"),commit:async()=>calls.push("commit"),rollback:async()=>calls.push("rollback"),release:()=>calls.push("release"),query:async(sql,values=[])=>{assert.equal(values.length,(sql.match(/\?/g)??[]).length,`placeholder mismatch: ${sql}`);calls.push(sql);return[[],[]];}};
  const repository=new MySqlResilienceRepository({getConnection:async()=>connection});
  await repository.record({actorId:"00000000-0000-4000-8000-000000000803",requestId:"request",traceId:"trace",observedAt:new Date("2026-08-14T13:00:00.000Z"),snapshot:{available:true,version:"5.7.44-log",readOnly:false,logBinEnabled:true,binlogFormat:"ROW",productDatabaseBinlogExcluded:false,innodbFlushLogAtTrxCommit:2,syncBinlog:1,masterStatusAvailable:true,replicaConfigured:false,bufferPoolBytes:1000,bufferPoolDataBytes:500,bufferPoolHitRateBasisPoints:9999,maxConnections:512,threadsConnected:2,threadsRunning:1,slowQueriesPerMinute:0,longQueryTimeSeconds:2,dataFilesystemTotalBytes:1000,dataFilesystemAvailableBytes:600,innodbLogWaits:0,innodbRowLockWaits:0,uptimeSeconds:10,backupStatus:"verified",actualRpoMinutes:1,actualRtoMinutes:3,recoveryDrillAgeDays:1},evaluation:{state:"ready",connectionUsageBasisPoints:39,dataUsageBasisPoints:4000,findings:[],singlePrimary:true,replicaEnabled:false,backupServerUsed:false,capacityClaim:"unverified"}});
  assert.deepEqual(calls.filter((item)=>["begin","commit","rollback","release"].includes(item)),["begin","commit","release"]);
  assert.equal(calls.filter((item)=>typeof item==="string"&&item.startsWith("INSERT INTO")).length,3);
});

test("M08-03.A04/A14 probe follows the real M07-04 backup and isolated recovery schema", async () => {
  const {MySqlResilienceProbe}=await import("../../apps/api/dist/mysql-resilience-probe.js");
  const variables={version:"5.7.44-log",read_only:"OFF",log_bin:"ON",binlog_format:"ROW",binlog_ignore_db:"",innodb_flush_log_at_trx_commit:"2",sync_binlog:"1",innodb_buffer_pool_size:"4294967296",max_connections:"512",long_query_time:"2",datadir:"."};
  const statuses={threads_connected:"20",threads_running:"2",slow_queries:"0",uptime:"3600",innodb_buffer_pool_reads:"1",innodb_buffer_pool_read_requests:"100000",innodb_buffer_pool_bytes_data:"2147483648",innodb_log_waits:"0",innodb_row_lock_waits:"0"};
  const pool={query:async(sql,values=[])=>{
    if(sql.startsWith("SHOW GLOBAL VARIABLES"))return[values.map((name)=>({Variable_name:name,Value:variables[String(name).toLowerCase()]??""})),[]];
    if(sql.startsWith("SHOW GLOBAL STATUS"))return[values.map((name)=>({Variable_name:name,Value:statuses[String(name).toLowerCase()]??"0"})),[]];
    if(sql==="SHOW MASTER STATUS")return[[{File:"redacted"}],[]];
    if(sql==="SHOW SLAVE STATUS")return[[],[]];
    if(sql.includes("mysql_resilience_observations"))return[[],[]];
    if(sql.includes("backup_recovery_runs")){assert.match(sql,/run_type/);assert.match(sql,/finished_at/);assert.doesNotMatch(sql,/\bkind\b|completed_at/);return[[{id:"backup",run_type:"backup",status:"verified",actual_rpo_minutes:"1",actual_rto_minutes:null,finished_at:"2026-08-14T12:00:00.000Z",isolated:0,encrypted:1,integrity_verified:1,permission_boundary_verified:0,audit_chain_verified:0,evidence_hash_verified:0},{id:"drill",run_type:"restore_drill",status:"verified",actual_rpo_minutes:null,actual_rto_minutes:"3",finished_at:"2026-08-14T12:00:00.000Z",isolated:1,encrypted:1,integrity_verified:1,permission_boundary_verified:1,audit_chain_verified:1,evidence_hash_verified:1}],[]];}
    if(sql.includes("backup_recovery_assets")){assert.equal(values[0],"backup");return[[{asset_kind:"mysql_full",encrypted:1,integrity_verified:1},{asset_kind:"mysql_binlog",encrypted:1,integrity_verified:1}],[]];}
    throw new Error(`unexpected query: ${sql}`);
  }};
  const snapshot=await new MySqlResilienceProbe(pool,()=>new Date("2026-08-14T13:00:00.000Z")).snapshot();
  assert.equal(snapshot.backupStatus,"verified");assert.equal(snapshot.actualRpoMinutes,1);assert.equal(snapshot.actualRtoMinutes,3);assert.equal(snapshot.recoveryDrillAgeDays,0.04);
});

test("M08-03.A10/A13 upgrades the release gate to ROW binlog inclusion without changing canary thresholds", async () => {
  const [manifest,runner,verifier,schema,featureMap,plan,architecture,runbook]=await Promise.all([
    "infra/baota/release-rollout-manifest.json","scripts/run-baota-release-rollout.mjs","scripts/verify-release-rollout-production.mjs","verification/release-rollout-production-evidence.schema.json","docs/feature-map.json","plans/phase-07-release-production.md","docs/architecture/m07-05-release-rollout.md","docs/runbooks/m07-05-release-rollout.md",
  ].map(async(path)=>[path,await readFile(path,"utf8")]));
  const sources=Object.fromEntries([manifest,runner,verifier,schema,featureMap,plan,architecture,runbook]);
  const contract=JSON.parse(sources["infra/baota/release-rollout-manifest.json"]);
  assert.equal(contract.schemaVersion,6);assert.equal(contract.mysqlDurability.binlogFormat,"ROW");assert.equal(contract.mysqlDurability.productScoutBinlogExcluded,false);
  assert.deepEqual(contract.canary.percentages,[5,25,100]);assert.equal(contract.canary.minimumObservationSeconds,1800);assert.equal(contract.automaticStop.writeP95MsInclusive,600);
  for(const source of Object.values(sources)){assert.match(source,/binlogFormat|binlog_format|binlog-format/);assert.doesNotMatch(source,/binlog-ignore-db=product_scout|productScoutBinlogExcluded["']?\s*[:=]\s*true/);}
});

test("M08-03.A07/A08/A15/A16 UI and production evidence cover full states and recovery", async () => {
  const [ui, e2e, manifest, architecture, runbook] = await Promise.all([
    "apps/web/src/components/MySqlResilienceCenter.vue", "tests/e2e/m08-03-mysql-resilience.spec.ts",
    "infra/baota/mysql-single-primary-manifest.json", "docs/architecture/m08-03-mysql-resilience.md", "docs/runbooks/m08-03-mysql-resilience.md",
  ].map((path) => readFile(path, "utf8")));
  for (const state of ["loading","ready","warning","blocked","empty","forbidden","expired","rate_limited","unavailable","recovering"]) assert.match(ui, new RegExp(state));
  assert.match(e2e, /390/); assert.match(manifest, /single_primary/); assert.match(manifest, /innodb_flush_log_at_trx_commit/); assert.match(manifest, /sync_binlog/);
  assert.match(architecture, /61_平台运营-概览\.jpg/); assert.match(architecture, /64_系统监控\.jpg/); assert.match(architecture, /69_异常告警\.jpg/); assert.match(architecture, /10_霓虹科技平台驾驶舱_dashboard\.png/);
  assert.match(runbook, /宝塔/); assert.match(runbook, /## 回滚/); assert.doesNotMatch(`${ui}\n${e2e}\n${manifest}\n${runbook}`, /replica_enabled\s*[:=]\s*true|备用服务器已启用|异地灾备已启用/i);
});
