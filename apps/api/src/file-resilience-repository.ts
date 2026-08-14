import { randomUUID } from "node:crypto";
import type { Pool } from "mysql2/promise";
import type { FileResilienceRepository as Contract } from "./file-resilience-service.js";

export class FileResilienceRepository implements Contract {
  constructor(private readonly pool:Pick<Pool,"getConnection">){}
  async record(input:Parameters<Contract["record"]>[0]){const connection=await this.pool.getConnection(),observationId=randomUUID();const roots=input.snapshot.roots;try{
    await connection.beginTransaction();
    await connection.query("INSERT INTO file_resilience_observations(id,organization_id,workspace_id,manager,mode,state,root_count,available_root_count,active_file_count,indexed_bytes,maximum_usage_basis_points,checksum_sampled_files,checksum_verified_files,checksum_mismatch_files,missing_files,recovery_status,recovery_drill_age_days,finding_codes_json,request_id,trace_id,observed_at) VALUES(?,NULL,NULL,'baota','local_managed_directories',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",[observationId,input.evaluation.state,roots.length,roots.filter((root)=>root.available&&root.writable).length,roots.reduce((sum,root)=>sum+root.activeFiles,0),roots.reduce((sum,root)=>sum+root.indexedBytes,0),input.evaluation.maximumUsageBasisPoints,input.snapshot.checksumSampledFiles,input.snapshot.checksumVerifiedFiles,input.snapshot.checksumMismatchFiles,input.snapshot.missingFiles,input.snapshot.recoveryStatus,input.snapshot.recoveryDrillAgeDays,JSON.stringify(input.evaluation.findings.map((item)=>item.code)),input.requestId,input.traceId,input.observedAt]);
    await connection.query("INSERT INTO file_resilience_views(id,actor_id,observation_id,request_id,trace_id,observed_at) VALUES(?,?,?,?,?,?)",[randomUUID(),input.actorId,observationId,input.requestId,input.traceId,input.observedAt]);
    await connection.query("INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) VALUES(?,NULL,NULL,?,'platform.file_resilience.read','local_managed_storage',?,'succeeded',?,?,?,?,1)",[randomUUID(),input.actorId,observationId,input.requestId,input.traceId,JSON.stringify({state:input.evaluation.state,root_count:roots.length,active_file_count:roots.reduce((sum,root)=>sum+root.activeFiles,0),maximum_usage_basis_points:input.evaluation.maximumUsageBasisPoints,checksum_mismatch_files:input.snapshot.checksumMismatchFiles,missing_files:input.snapshot.missingFiles,recovery_status:input.snapshot.recoveryStatus,organization_scoped:true,public_access_enabled:false,shared_storage_enabled:false,backup_server_used:false}),input.observedAt]);
    await connection.commit();
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}}
}
