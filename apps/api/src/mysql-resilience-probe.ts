import { statfs } from "node:fs/promises";
import type { Pool,RowDataPacket } from "mysql2/promise";
import type { MySqlRecoveryStatus,MySqlResilienceSnapshot } from "@scoutops/database";

type ScalarMap=Record<string,string>;
const number=(value:unknown)=>Number.isFinite(Number(value))?Number(value):0;
const enabled=(value:unknown)=>["1","ON","TRUE"].includes(String(value).toUpperCase());
export class MySqlResilienceProbe{
  constructor(private readonly pool:Pool,private readonly now=()=>new Date()){}
  private async variables(names:string[]){const [rows]=await this.pool.query<RowDataPacket[]>(`SHOW GLOBAL VARIABLES WHERE Variable_name IN (${names.map(()=>"?").join(",")})`,names);return Object.fromEntries(rows.map((row)=>[String(row.Variable_name).toLowerCase(),String(row.Value)])) as ScalarMap;}
  private async status(names:string[]){const [rows]=await this.pool.query<RowDataPacket[]>(`SHOW GLOBAL STATUS WHERE Variable_name IN (${names.map(()=>"?").join(",")})`,names);return Object.fromEntries(rows.map((row)=>[String(row.Variable_name).toLowerCase(),String(row.Value)])) as ScalarMap;}
  async snapshot():Promise<MySqlResilienceSnapshot>{
    const variables=await this.variables(["version","read_only","log_bin","binlog_format","binlog_ignore_db","innodb_flush_log_at_trx_commit","sync_binlog","innodb_buffer_pool_size","max_connections","long_query_time","datadir"]);
    const status=await this.status(["Threads_connected","Threads_running","Slow_queries","Uptime","Innodb_buffer_pool_reads","Innodb_buffer_pool_read_requests","Innodb_buffer_pool_bytes_data","Innodb_log_waits","Innodb_row_lock_waits"]);
    const [masterRows]=await this.pool.query<RowDataPacket[]>("SHOW MASTER STATUS");
    const [replicaRows]=await this.pool.query<RowDataPacket[]>("SHOW SLAVE STATUS");
    const [previousRows]=await this.pool.query<RowDataPacket[]>("SELECT slow_queries_total,observed_at FROM mysql_resilience_observations ORDER BY observed_at DESC LIMIT 1").catch(()=>[[] as RowDataPacket[],[]] as never);
    const slowTotal=number(status.slow_queries),uptime=Math.max(1,number(status.uptime));
    const previous=previousRows[0];const elapsed=previous?Math.max(1,(this.now().getTime()-new Date(previous.observed_at).getTime())/60000):uptime/60;
    const slowPerMinute=previous?Math.max(0,(slowTotal-number(previous.slow_queries_total))/elapsed):slowTotal/elapsed;
    const reads=number(status.innodb_buffer_pool_reads),requests=number(status.innodb_buffer_pool_read_requests);
    const hitRate=requests>0?Math.max(0,Math.round((1-reads/requests)*10000)):10000;
    const fs=await statfs(variables.datadir||".");const total=Number(fs.blocks)*Number(fs.bsize),available=Number(fs.bavail)*Number(fs.bsize);
    const [recoveryRows]=await this.pool.query<RowDataPacket[]>("SELECT id,run_type,status,actual_rpo_minutes,actual_rto_minutes,finished_at,isolated,encrypted,integrity_verified,permission_boundary_verified,audit_chain_verified,evidence_hash_verified FROM backup_recovery_runs WHERE run_type IN ('backup','restore_drill') ORDER BY started_at DESC LIMIT 20").catch(()=>[[] as RowDataPacket[],[]] as never);
    const backup=recoveryRows.find((row)=>row.run_type==="backup"),recovery=recoveryRows.find((row)=>row.run_type==="restore_drill");
    const [assetRows]=backup?await this.pool.query<RowDataPacket[]>("SELECT asset_kind,encrypted,integrity_verified FROM backup_recovery_assets WHERE run_id=? AND storage_role='recovery_copy'",[backup.id]).catch(()=>[[] as RowDataPacket[],[]] as never):[[] as RowDataPacket[],[]];
    const recoveryKinds=new Set(assetRows.filter((row)=>Boolean(row.encrypted)&&Boolean(row.integrity_verified)).map((row)=>String(row.asset_kind)));
    const backupVerified=backup?.status==="verified"&&Boolean(backup.encrypted)&&Boolean(backup.integrity_verified)&&number(backup.actual_rpo_minutes)<=15&&recoveryKinds.has("mysql_full")&&recoveryKinds.has("mysql_binlog");
    const recoveryVerified=recovery?.status==="verified"&&Boolean(recovery.isolated)&&Boolean(recovery.encrypted)&&Boolean(recovery.integrity_verified)&&Boolean(recovery.permission_boundary_verified)&&Boolean(recovery.audit_chain_verified)&&Boolean(recovery.evidence_hash_verified)&&number(recovery.actual_rto_minutes)<=240;
    let backupStatus:MySqlRecoveryStatus="empty",drillAge:number|null=null;
    if(recovery?.finished_at)drillAge=Math.max(0,(this.now().getTime()-new Date(recovery.finished_at).getTime())/86400000);
    if(backup||recovery)backupStatus=backupVerified&&recoveryVerified&&drillAge!==null?(drillAge<=90?"verified":"stale"):"blocked";
    const binlogFormat=variables.binlog_format||"unknown";
    return {available:true,version:variables.version||"unknown",readOnly:enabled(variables.read_only),logBinEnabled:enabled(variables.log_bin),binlogFormat:["ROW","MIXED","STATEMENT"].includes(binlogFormat)?binlogFormat as "ROW"|"MIXED"|"STATEMENT":"unknown",productDatabaseBinlogExcluded:(variables.binlog_ignore_db||"").split(",").map((item)=>item.trim()).includes("product_scout"),innodbFlushLogAtTrxCommit:number(variables.innodb_flush_log_at_trx_commit),syncBinlog:number(variables.sync_binlog),masterStatusAvailable:masterRows.length===1,replicaConfigured:replicaRows.length>0,bufferPoolBytes:number(variables.innodb_buffer_pool_size),bufferPoolDataBytes:number(status.innodb_buffer_pool_bytes_data),bufferPoolHitRateBasisPoints:hitRate,maxConnections:number(variables.max_connections),threadsConnected:number(status.threads_connected),threadsRunning:number(status.threads_running),slowQueriesTotal:slowTotal,slowQueriesPerMinute:Number(slowPerMinute.toFixed(3)),longQueryTimeSeconds:number(variables.long_query_time),dataFilesystemTotalBytes:total,dataFilesystemAvailableBytes:available,innodbLogWaits:number(status.innodb_log_waits),innodbRowLockWaits:number(status.innodb_row_lock_waits),uptimeSeconds:uptime,backupStatus,actualRpoMinutes:backup?.actual_rpo_minutes==null?null:number(backup.actual_rpo_minutes),actualRtoMinutes:recovery?.actual_rto_minutes==null?null:number(recovery.actual_rto_minutes),recoveryDrillAgeDays:drillAge===null?null:Number(drillAge.toFixed(2))};
  }
}
