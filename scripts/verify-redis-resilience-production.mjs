import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import {validateRedisResilienceEvidence} from "./redis-resilience-evidence.mjs";

const mode=process.argv[2]??"--preflight";
const manifest=JSON.parse(await readFile(new URL("../infra/baota/redis-single-instance-manifest.json",import.meta.url),"utf8"));
if(manifest.schemaVersion!==1||manifest.module!=="M08-02"||manifest.manager!=="baota"||manifest.mode!=="single_instance"||manifest.persistence?.appendonly!==true||manifest.persistence?.appendfsync!=="everysec"||manifest.limits?.maxmemoryBytes!==536870912||manifest.limits?.maxclients!==512||manifest.limits?.maxmemoryPolicy!=="noeviction")throw new Error("redis_resilience_manifest_invalid");
if(mode==="--preflight"){console.log(JSON.stringify({module:"M08-02",status:"preflight_passed",manager:"baota",mode:"single_instance",appendonly:true,maxmemoryBytes:manifest.limits.maxmemoryBytes,maxclients:manifest.limits.maxclients,capacityClaim:"unverified"}));process.exit(0);}
if(mode!=="--production")throw new Error("redis_resilience_verification_mode_invalid");
const evidencePath=process.env.REDIS_RESILIENCE_PRODUCTION_EVIDENCE_FILE?.trim()||"./.artifacts/verification/m08-02-redis-resilience-production-evidence.json";
let source;
try{source=await readFile(evidencePath);}catch(error){if(error?.code!=="ENOENT")throw error;console.error(JSON.stringify({module:"M08-02",status:"blocked",code:"production_evidence_missing",action_hint:"通过当前惠州单机的宝塔有限任务完成 Redis 配置、重启、恢复核验并签发同提交证据。"}));process.exit(1);}
const evidence=JSON.parse(source.toString("utf8")),head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),maxAgeMinutes=Number(process.env.REDIS_RESILIENCE_EVIDENCE_MAX_AGE_MINUTES??60);
const result=validateRedisResilienceEvidence({evidence,manifest,head,maxAgeMs:maxAgeMinutes*60_000}),digest=createHash("sha256").update(source).digest("hex");
console.log(JSON.stringify({module:"M08-02",status:"passed",buildSha:head,mode:"single_instance",...result,evidenceSha256:digest,capacityClaim:"unverified"}));
