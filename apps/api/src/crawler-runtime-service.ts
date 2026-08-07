import { randomUUID } from 'node:crypto';
import { createLeaseToken, hashLeaseToken } from '@scoutops/playwright-crawler';

export type CrawlerRuntimeStatus='running'|'succeeded'|'blocked'|'failed'|'timed_out'|'cancelled';
export interface CrawlerRunSummary{id:string;organization_id:string;workspace_id:string;provider_id:string;crawler_profile_id:string;status:CrawlerRuntimeStatus;page_count:number;item_count:number;detail_count:number;duration_ms:number|null;error_code:string|null;request_id:string;trace_id:string;started_at:string;finished_at:string|null;}
export interface CrawlerProfileRuntime{id:string;code:string;name:string;provider_id:string;provider_name:string;status:string;lease:null|{run_id:string;lease_owner:string;leased_at:string;heartbeat_at:string;expires_at:string};}
export interface CrawlerRuntimeSnapshot{profiles:CrawlerProfileRuntime[];runs:CrawlerRunSummary[];observed_at:string;}
export interface RuntimeContext{actorId:string;requestId:string;traceId:string;}
export interface AcquireInput extends RuntimeContext{organizationId:string;workspaceId:string;profileId:string;leaseOwner:string;idempotencyKey:string;leaseSeconds:number;}
export interface CrawlerRuntimeRepository{
  list():Promise<{profiles:CrawlerProfileRuntime[];runs:CrawlerRunSummary[]}>;
  acquire(input:AcquireInput&{runId:string;leaseId:string;leaseTokenHash:string;now:Date;expiresAt:Date}):Promise<{run:CrawlerRunSummary;replayed:boolean}>;
  heartbeat(input:{runId:string;profileId:string;leaseTokenHash:string;actorId:string;requestId:string;traceId:string;now:Date;expiresAt:Date}):Promise<void>;
  finish(input:{runId:string;profileId:string;leaseTokenHash:string;actorId:string;requestId:string;traceId:string;now:Date;status:Exclude<CrawlerRuntimeStatus,'running'>;pageCount:number;itemCount:number;detailCount:number;durationMs:number;errorCode:string|null}):Promise<void>;
  recoverExpired(input:RuntimeContext&{now:Date;idempotencyKey:string}):Promise<{recovered:number}>;
}
export class CrawlerRuntimeError extends Error{constructor(readonly code:string,readonly statusCode:number,readonly actionHint:string){super(code);this.name='CrawlerRuntimeError';}}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class CrawlerRuntimeService{
  constructor(private readonly repository:CrawlerRuntimeRepository,private readonly now:()=>Date=()=>new Date()){}
  async list():Promise<CrawlerRuntimeSnapshot>{const result=await this.repository.list();return{...result,observed_at:this.now().toISOString()};}
  async acquire(input:AcquireInput){if(!uuid.test(input.organizationId)||!uuid.test(input.workspaceId)||!uuid.test(input.profileId))throw new CrawlerRuntimeError('crawler_scope_invalid',400,'刷新组织、工作区与档案后重试。');if(!/^[A-Za-z0-9._:-]{2,160}$/.test(input.leaseOwner))throw new CrawlerRuntimeError('crawler_lease_owner_invalid',400,'使用稳定的 Crawler 实例标识。');if(!Number.isInteger(input.leaseSeconds)||input.leaseSeconds<30||input.leaseSeconds>600)throw new CrawlerRuntimeError('crawler_lease_ttl_invalid',400,'租约时长应为 30–600 秒。');const now=this.now(),lease=createLeaseToken(),result=await this.repository.acquire({...input,runId:randomUUID(),leaseId:lease.id,leaseTokenHash:hashLeaseToken(lease.token),now,expiresAt:new Date(now.getTime()+input.leaseSeconds*1000)});return{...result,lease_token:result.replayed?null:lease.token};}
  async heartbeat(input:{runId:string;profileId:string;leaseToken:string;leaseSeconds:number}&RuntimeContext){if(!uuid.test(input.runId)||!uuid.test(input.profileId)||typeof input.leaseToken!=='string'||input.leaseToken.length<32||!Number.isInteger(input.leaseSeconds)||input.leaseSeconds<30||input.leaseSeconds>600)throw new CrawlerRuntimeError('crawler_heartbeat_invalid',400,'使用当前运行的有效租约并保持 30–600 秒心跳时长。');const now=this.now();await this.repository.heartbeat({...input,leaseTokenHash:hashLeaseToken(input.leaseToken),now,expiresAt:new Date(now.getTime()+input.leaseSeconds*1000)});}
  async finish(input:{runId:string;profileId:string;leaseToken:string;status:Exclude<CrawlerRuntimeStatus,'running'>;pageCount:number;itemCount:number;detailCount:number;durationMs:number;errorCode:string|null}&RuntimeContext){if(!uuid.test(input.runId)||!uuid.test(input.profileId)||typeof input.leaseToken!=='string'||input.leaseToken.length<32||!['succeeded','blocked','failed','timed_out','cancelled'].includes(input.status)||![input.pageCount,input.itemCount,input.detailCount,input.durationMs].every(value=>Number.isSafeInteger(value)&&value>=0&&value<=4294967295)||input.errorCode!==null&&!/^[A-Za-z0-9._:-]{1,80}$/.test(input.errorCode))throw new CrawlerRuntimeError('crawler_result_invalid',400,'按浏览器运行结果合同提交计数、状态与错误码。');await this.repository.finish({...input,leaseTokenHash:hashLeaseToken(input.leaseToken),now:this.now()});}
  recoverExpired(context:RuntimeContext&{idempotencyKey:string}){return this.repository.recoverExpired({...context,now:this.now()});}
}
