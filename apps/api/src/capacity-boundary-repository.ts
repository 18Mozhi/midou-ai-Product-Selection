import {randomUUID} from "node:crypto";
import type {Pool,RowDataPacket} from "mysql2/promise";
import type {CapacityBoundaryRepositoryContract as Contract,CapacityBoundaryStopReason} from "./capacity-boundary-service.js";

const n=(v:unknown)=>Number(v??0),b=(v:unknown)=>Boolean(Number(v));
const utcDateTime=(value:unknown)=>{const parsed=new Date(String(value));if(!Number.isFinite(parsed.getTime()))throw new Error("capacity_observed_at_invalid");return parsed.toISOString();};
const findingCodes=(value:unknown):string[]=>{try{const parsed=typeof value==="string"?JSON.parse(value):value;return Array.isArray(parsed)?parsed.filter((item):item is string=>typeof item==="string"):[];}catch{return[];}};
function boundaryStop(value:unknown):{boundary_stop_reason:CapacityBoundaryStopReason|null;failed_next_concurrency:number|null;failed_next_code:string|null}{
  const codes=findingCodes(value),next=codes.map(code=>code.match(/^capacity_boundary_stop:next_stage_gate_failed:(5|10|20):([a-z0-9_]+)$/)).find(Boolean);
  if(next)return{boundary_stop_reason:"next_stage_gate_failed",failed_next_concurrency:Number(next[1]),failed_next_code:String(next[2])};
  if(codes.includes("capacity_boundary_stop:planning_ceiling_reached:20"))return{boundary_stop_reason:"planning_ceiling_reached",failed_next_concurrency:null,failed_next_code:null};
  return{boundary_stop_reason:null,failed_next_concurrency:null,failed_next_code:null};
}

export class CapacityBoundaryRepository implements Contract{
  constructor(private readonly pool:Pool){}
  async snapshot(_now:Date){
    const[rows]=await this.pool.query<RowDataPacket[]>("SELECT measured_concurrency,read_p95_ms,write_p95_ms,error_rate_basis_points,async_lag_seconds,load_basis_points,available_memory_mb,free_disk_mb,archive_verified,recovery_verified,finding_codes_json,CONCAT(DATE_FORMAT(observed_at,'%Y-%m-%dT%H:%i:%s.'),LPAD(FLOOR(MICROSECOND(observed_at)/1000),3,'0'),'Z') observed_at_utc FROM capacity_boundary_observations WHERE source='production_benchmark' ORDER BY observed_at DESC LIMIT 1");
    const r=rows[0];
    return r?{measured_concurrency:n(r.measured_concurrency),read_p95_ms:n(r.read_p95_ms),write_p95_ms:n(r.write_p95_ms),error_rate_basis_points:n(r.error_rate_basis_points),async_lag_seconds:n(r.async_lag_seconds),load_basis_points:n(r.load_basis_points),available_memory_mb:n(r.available_memory_mb),free_disk_mb:n(r.free_disk_mb),archive_verified:b(r.archive_verified),recovery_verified:b(r.recovery_verified),...boundaryStop(r.finding_codes_json),observed_at:utcDateTime(r.observed_at_utc)}:null;
  }
  async recordView(input:Parameters<Contract["recordView"]>[0]){
    const c=await this.pool.getConnection(),id=randomUUID();
    try{
      await c.beginTransaction();
      await c.query("INSERT INTO capacity_boundary_observations(id,source,state,measured_concurrency,planning_users,read_p95_ms,write_p95_ms,error_rate_basis_points,async_lag_seconds,load_basis_points,available_memory_mb,free_disk_mb,archive_verified,recovery_verified,finding_codes_json,request_id,trace_id,observed_at) VALUES(?,'api_view',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",[id,input.evaluation.state,input.snapshot.measured_concurrency,100,input.snapshot.read_p95_ms,input.snapshot.write_p95_ms,input.snapshot.error_rate_basis_points,input.snapshot.async_lag_seconds,input.snapshot.load_basis_points,input.snapshot.available_memory_mb,input.snapshot.free_disk_mb,input.snapshot.archive_verified?1:0,input.snapshot.recovery_verified?1:0,JSON.stringify(input.evaluation.findings.map(x=>x.code)),input.requestId,input.traceId,input.observedAt]);
      await c.query("INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) VALUES(?,NULL,NULL,?,'platform.capacity_boundary.read','capacity_boundary',?,'succeeded',?,?,?,?,1)",[randomUUID(),input.actorId,id,input.requestId,input.traceId,JSON.stringify({state:input.evaluation.state,measured_concurrency:input.snapshot.measured_concurrency,capacity_claim:input.evaluation.state==="blocked"?"unverified":"measured_single_host_limited",boundary_stop_reason:input.snapshot.boundary_stop_reason,failed_next_concurrency:input.snapshot.failed_next_concurrency,single_host:true}),input.observedAt]);
      await c.commit();
    }catch(error){await c.rollback();throw error;}finally{c.release();}
  }
  async attestDrill(input:Parameters<Contract["attestDrill"]>[0]){
    const c=await this.pool.getConnection(),route="/platform/operations/capacity/drills";
    try{
      await c.beginTransaction();
      const[replay]=await c.query<RowDataPacket[]>("SELECT result_json FROM capacity_boundary_operations WHERE actor_id=? AND route=? AND idempotency_key=? LIMIT 1",[input.actorId,route,input.idempotencyKey]);
      if(replay[0]){await c.commit();return typeof replay[0].result_json==="string"?JSON.parse(replay[0].result_json):replay[0].result_json;}
      const[observations]=await c.query<RowDataPacket[]>("SELECT id FROM capacity_boundary_observations WHERE source='production_benchmark' AND archive_verified=1 AND recovery_verified=1 ORDER BY observed_at DESC LIMIT 1 FOR UPDATE");
      if(!observations[0])throw new Error("capacity_drill_observation_missing");
      const result={status:"verified" as const,observed_at:input.now.toISOString()},drillId=randomUUID();
      await c.query("INSERT INTO capacity_boundary_drills(id,kind,status,reason,actor_id,observation_id,request_id,trace_id,observed_at) VALUES(?,'archive_recovery','verified',?,?,?,?,?,?)",[drillId,input.reason,input.actorId,String(observations[0].id),input.requestId,input.traceId,input.now]);
      await c.query("INSERT INTO capacity_boundary_operations(id,actor_id,route,idempotency_key,result_json,request_id,trace_id,created_at) VALUES(?,?,?,?,?,?,?,?)",[randomUUID(),input.actorId,route,input.idempotencyKey,JSON.stringify(result),input.requestId,input.traceId,input.now]);
      await c.query("INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) VALUES(?,NULL,NULL,?,'platform.capacity_boundary.attest_drill','capacity_boundary_drill',?,'succeeded',?,?,?,?,1)",[randomUUID(),input.actorId,drillId,input.requestId,input.traceId,JSON.stringify({kind:input.kind,status:"verified",single_host:true}),input.now]);
      await c.commit();return result;
    }catch(error){await c.rollback();throw error;}finally{c.release();}
  }
}
