export type CapacityBoundaryState="ready"|"warning"|"blocked";
export type CapacityBoundaryStopReason="next_stage_gate_failed"|"planning_ceiling_reached";
export interface CapacityBoundarySnapshot{
  measured_concurrency:number;
  read_p95_ms:number;
  write_p95_ms:number;
  error_rate_basis_points:number;
  async_lag_seconds:number;
  load_basis_points:number;
  available_memory_mb:number;
  free_disk_mb:number;
  archive_verified:boolean;
  recovery_verified:boolean;
  boundary_stop_reason:CapacityBoundaryStopReason|null;
  failed_next_concurrency:number|null;
  failed_next_code:string|null;
  observed_at:string;
}
export interface CapacityBoundaryPolicy{readP95StopMs:number;writeP95StopMs:number;errorRateStopBasisPoints:number;asyncLagStopSeconds:number;maximumLoadBasisPoints:number;minimumAvailableMemoryMb:number;minimumFreeDiskMb:number;maximumEvidenceAgeMinutes:number}
export interface CapacityBoundaryFinding{code:string;severity:"warning"|"blocked";action_hint:string}
export interface CapacityBoundaryEvaluation{state:CapacityBoundaryState;findings:CapacityBoundaryFinding[]}
export interface CapacityBoundaryRepositoryContract{
  snapshot(now:Date):Promise<CapacityBoundarySnapshot|null>;
  recordView(input:{actorId:string;requestId:string;traceId:string;observedAt:Date;snapshot:CapacityBoundarySnapshot;evaluation:CapacityBoundaryEvaluation}):Promise<void>;
  attestDrill(input:{actorId:string;requestId:string;traceId:string;idempotencyKey:string;kind:"archive_recovery";reason:string;now:Date}):Promise<{status:"verified";observed_at:string}>;
}
export class CapacityBoundaryError extends Error{constructor(public readonly code:string,public readonly statusCode:number,public readonly actionHint:string){super(code);}}

export function evaluateCapacityBoundary(snapshot:CapacityBoundarySnapshot,policy:CapacityBoundaryPolicy,now=new Date()):CapacityBoundaryEvaluation{
  const findings:CapacityBoundaryFinding[]=[];
  const blocked=(code:string,action_hint:string)=>findings.push({code,severity:"blocked",action_hint});
  const warning=(code:string,action_hint:string)=>findings.push({code,severity:"warning",action_hint});
  const age=now.getTime()-Date.parse(snapshot.observed_at);
  if(!Number.isFinite(age)||age<0||age>policy.maximumEvidenceAgeMinutes*60000)blocked("capacity_evidence_stale","重新运行惠州单机受控容量基线并签发同提交证据。");
  if(snapshot.measured_concurrency<5)blocked("capacity_measurement_missing","固定并发 5 必须先完整通过，禁止用规划值或未通过档位代替实测边界。");
  if(snapshot.read_p95_ms>policy.readP95StopMs)blocked("capacity_read_latency_exceeded","保持降载并检查 API、MySQL 与 Redis 读路径。");else if(snapshot.read_p95_ms>=Math.round(policy.readP95StopMs*.9))warning("capacity_read_latency_warning","读 P95 接近停止线，暂停后台非关键工作并持续观察。");
  if(snapshot.write_p95_ms>policy.writeP95StopMs)blocked("capacity_write_latency_exceeded","停止新增后台工作并检查 MySQL 持久写路径。");else if(snapshot.write_p95_ms>=Math.round(policy.writeP95StopMs*.9))warning("capacity_write_latency_warning","写 P95 接近停止线，维持单 Worker/Crawler 并降低任务进入速度。");
  if(snapshot.error_rate_basis_points>=policy.errorRateStopBasisPoints)blocked("capacity_error_rate_exceeded","停止扩大并发并按 trace_id 排查失败请求。");else if(snapshot.error_rate_basis_points>=Math.round(policy.errorRateStopBasisPoints*.8))warning("capacity_error_rate_warning","错误率接近停止线，保持当前实测边界不再扩大。");
  if(snapshot.async_lag_seconds>policy.asyncLagStopSeconds)blocked("capacity_async_lag_exceeded","保持任务排队并暂停非关键异步处理。");else if(snapshot.async_lag_seconds>=Math.round(policy.asyncLagStopSeconds*.8))warning("capacity_async_lag_warning","异步滞后接近停止线，优先处理既有队列。");
  if(snapshot.load_basis_points>=policy.maximumLoadBasisPoints)blocked("capacity_host_load_exceeded","通过宝塔停止新增后台工作并核查主机资源。");else if(snapshot.load_basis_points>=Math.round(policy.maximumLoadBasisPoints*.9))warning("capacity_host_load_warning","主机负载接近停止线，保持降载策略。");
  if(snapshot.available_memory_mb<policy.minimumAvailableMemoryMb)blocked("capacity_memory_exceeded","保持降载并通过宝塔检查内存使用。");
  if(snapshot.free_disk_mb<policy.minimumFreeDiskMb)blocked("capacity_disk_exceeded","停止新增文件任务并通过宝塔清理或扩容受控目录。");
  if(!snapshot.archive_verified)blocked("capacity_archive_unverified","通过宝塔有限任务验证归档副本后再签发容量边界。");
  if(!snapshot.recovery_verified)blocked("capacity_recovery_unverified","在隔离库和隔离目录完成恢复演练后再签发容量边界。");

  if(snapshot.measured_concurrency<20){
    const expectedNext=snapshot.measured_concurrency===5?10:snapshot.measured_concurrency===10?20:null;
    if(snapshot.boundary_stop_reason!=="next_stage_gate_failed"||snapshot.failed_next_concurrency!==expectedNext||!snapshot.failed_next_code)blocked("capacity_boundary_stop_missing","低于规划测量上限的边界必须保留下一档真实失败码和失败档位。");
    else warning("capacity_next_stage_gate_failed",`并发 ${snapshot.failed_next_concurrency} 已触发 ${snapshot.failed_next_code}；容量声明仅限已通过的并发 ${snapshot.measured_concurrency}，不得继续扩大。`);
  }else if(snapshot.boundary_stop_reason!=="planning_ceiling_reached"||snapshot.failed_next_concurrency!==null||snapshot.failed_next_code!==null)blocked("capacity_boundary_stop_invalid","并发 20 证据必须明确以规划测量上限结束且没有伪造下一档。");

  return{state:findings.some(item=>item.severity==="blocked")?"blocked":findings.length?"warning":"ready",findings};
}

export class CapacityBoundaryService{
  constructor(private readonly repository:CapacityBoundaryRepositoryContract,private readonly policy:CapacityBoundaryPolicy,private readonly now=()=>new Date()){}
  async read(input:{actorId:string;requestId:string;traceId:string}){
    const snapshot=await this.repository.snapshot(this.now());
    if(!snapshot)throw new CapacityBoundaryError("capacity_evidence_unavailable",503,"先通过宝塔有限任务完成同提交单机容量基线。");
    const observedAt=this.now(),evaluation=evaluateCapacityBoundary(snapshot,this.policy,observedAt);
    await this.repository.recordView({...input,observedAt,snapshot,evaluation});
    const mode=evaluation.state==="blocked"?"stop_new_work":evaluation.state==="warning"?"shed_background":"normal";
    return{state:evaluation.state,boundary:{measured_concurrency:snapshot.measured_concurrency,planning_users:100,planning_concurrency_min:5,planning_concurrency_max:20,capacity_claim:evaluation.state==="blocked"?"unverified":"measured_single_host_limited",stop_reason:snapshot.boundary_stop_reason,failed_next_concurrency:snapshot.failed_next_concurrency,failed_next_code:snapshot.failed_next_code},performance:{read_p95_ms:snapshot.read_p95_ms,write_p95_ms:snapshot.write_p95_ms,error_rate_basis_points:snapshot.error_rate_basis_points,async_lag_seconds:snapshot.async_lag_seconds},resource:{load_basis_points:snapshot.load_basis_points,available_memory_mb:snapshot.available_memory_mb,free_disk_mb:snapshot.free_disk_mb},resilience:{archive_verified:snapshot.archive_verified,recovery_verified:snapshot.recovery_verified},degradation:{mode,actions:evaluation.findings.map(item=>item.action_hint)},findings:evaluation.findings,single_host:true,load_balancing_enabled:false,backup_server_used:false,multi_node_claim:false,observed_at:snapshot.observed_at};
  }
  async attestDrill(input:{actorId:string;requestId:string;traceId:string;idempotencyKey:string;kind:unknown;reason:unknown}){
    if(input.kind!=="archive_recovery")throw new CapacityBoundaryError("capacity_drill_kind_invalid",400,"仅允许核验 archive_recovery 演练。");
    if(typeof input.reason!=="string"||input.reason.trim().length<2||input.reason.length>500)throw new CapacityBoundaryError("capacity_drill_reason_invalid",400,"提供 2–500 字符演练原因。");
    const snapshot=await this.repository.snapshot(this.now());
    if(!snapshot||!snapshot.archive_verified||!snapshot.recovery_verified)throw new CapacityBoundaryError("capacity_drill_not_verified",409,"先在宝塔有限任务中完成归档与隔离恢复事实核验。");
    return this.repository.attestDrill({actorId:input.actorId,requestId:input.requestId,traceId:input.traceId,idempotencyKey:input.idempotencyKey,kind:"archive_recovery",reason:input.reason.trim(),now:this.now()});
  }
}
