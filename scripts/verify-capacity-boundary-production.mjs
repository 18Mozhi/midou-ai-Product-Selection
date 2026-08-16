import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";

const mode=process.argv[2]??"--preflight";
const manifest=JSON.parse(await readFile(new URL("../infra/baota/capacity-boundary-manifest.json",import.meta.url),"utf8"));
const manifestValid=manifest.module==="M08-06"&&manifest.manager==="baota"&&manifest.mode==="single_host_measured_boundary"&&manifest.productionRegion==="惠州"&&manifest.planning?.users===100&&manifest.planning?.concurrentUsers?.minimum===5&&manifest.planning?.concurrentUsers?.maximum===20&&manifest.planning?.promise===false&&manifest.topologyClaims?.singleHost===true&&manifest.topologyClaims?.loadBalancingEnabled===false&&manifest.topologyClaims?.backupServerUsed===false&&manifest.topologyClaims?.multiNode===false;
if(!manifestValid)throw new Error("capacity_boundary_manifest_invalid");
if(mode==="--preflight"){console.log(JSON.stringify({module:"M08-06",status:"preflight_passed",manager:"baota",mode:"single_host_measured_boundary",planningUsers:100,planningConcurrency:[5,20],boundaryRule:"last_passing_stage",capacityClaim:"unverified"}));process.exit(0);}
if(mode!=="--production")throw new Error("capacity_boundary_verification_mode_invalid");

const path=process.env.CAPACITY_BOUNDARY_PRODUCTION_EVIDENCE_FILE?.trim()||"./.artifacts/verification/m08-06-capacity-boundary-production-evidence.json";
let source;
try{source=await readFile(path);}catch(error){if(error?.code!=="ENOENT")throw error;console.error(JSON.stringify({module:"M08-06",status:"blocked",code:"production_evidence_missing",action_hint:"通过惠州单机宝塔有限任务执行受控容量基线并签发同提交证据。"}));process.exit(1);}

const evidence=JSON.parse(source),head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),age=Date.now()-Date.parse(evidence.capturedAt),maxAge=Number(process.env.CAPACITY_BOUNDARY_EVIDENCE_MAX_AGE_MINUTES??60)*60000,expectedStages=[5,10,20];
const performancePass=stage=>stage&&stage.durationSeconds>=60&&stage.readP95Ms<=300&&stage.writeP95Ms<=600&&stage.errorRateBasisPoints<100&&stage.asyncLagSeconds<=60&&stage.loadBasisPoints<8500&&stage.availableMemoryMb>=1024&&stage.freeDiskMb>=4096&&stage.resourceStopGatePassed===true;
const performanceFailureCode=stage=>{if(!stage)return"capacity_stage_missing";if(stage.errorRateBasisPoints>=100)return"capacity_error_rate_exceeded";if(stage.readP95Ms>300)return"capacity_read_latency_exceeded";if(stage.writeP95Ms>600)return"capacity_write_latency_exceeded";if(stage.asyncLagSeconds>60)return"capacity_async_lag_exceeded";if(stage.loadBasisPoints>=8500)return"capacity_host_load_exceeded";if(stage.availableMemoryMb<1024)return"capacity_memory_exceeded";if(stage.freeDiskMb<4096)return"capacity_disk_exceeded";return null;};
const stagesValid=Array.isArray(evidence.stages)&&evidence.stages.length>=1&&evidence.stages.length<=3&&evidence.stages.every((stage,index)=>stage.concurrentUsers===expectedStages[index]&&performancePass(stage))&&evidence.measuredConcurrentUsers===evidence.stages.at(-1)?.concurrentUsers;
const stop=evidence.boundaryStop;
const boundaryStopValid=evidence.measuredConcurrentUsers===20
  ?stop?.reason==="planning_ceiling_reached"&&stop.failureCode===null&&stop.failedStage===null&&evidence.stages.length===3
  :stop?.reason==="next_stage_gate_failed"&&stop.failedStage?.concurrentUsers===expectedStages[evidence.stages.length]&&performanceFailureCode(stop.failedStage)===stop.failureCode;
const valid=evidence.schemaVersion===1&&evidence.module==="M08-06"&&evidence.status==="ready"&&evidence.buildSha===head&&evidence.manager==="baota"&&evidence.mode==="single_host_measured_boundary"&&evidence.region==="惠州"&&stagesValid&&boundaryStopValid&&evidence.planning?.users===100&&evidence.planning?.concurrentMinimum===5&&evidence.planning?.concurrentMaximum===20&&evidence.planning?.promise===false&&evidence.performance?.readP95Ms<=300&&evidence.performance?.writeP95Ms<=600&&evidence.performance?.errorRateBasisPoints<100&&evidence.performance?.asyncLagSeconds<=60&&evidence.performance?.samples>=1&&evidence.resource?.loadBasisPoints<8500&&evidence.resource?.availableMemoryMb>=1024&&evidence.resource?.freeDiskMb>=4096&&evidence.resource?.stopGatePassed===true&&evidence.resilience?.archiveVerified===true&&evidence.resilience?.recoveryVerified===true&&evidence.resilience?.auditVerified===true&&evidence.resilience?.probeRowsCleaned===true&&evidence.singleHost===true&&evidence.loadBalancingEnabled===false&&evidence.backupServerUsed===false&&evidence.multiNode===false&&evidence.capacityClaim==="measured_single_host_limited"&&age>=0&&age<=maxAge;
if(!valid){console.error(JSON.stringify({module:"M08-06",status:"blocked",code:"production_evidence_invalid_or_stale"}));process.exit(1);}
console.log(JSON.stringify({module:"M08-06",status:"passed",buildSha:head,evidenceSha256:createHash("sha256").update(source).digest("hex"),measuredConcurrentUsers:evidence.measuredConcurrentUsers,boundaryStop:evidence.boundaryStop,capacityClaim:evidence.capacityClaim}));
