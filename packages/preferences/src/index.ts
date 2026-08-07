import {createHash,randomUUID} from 'node:crypto';

export const THEME_IDS=['deep-ocean','aurora-purple','cloud-white'] as const;
export type ThemeId=(typeof THEME_IDS)[number];
export type PreferenceSource='default'|'saved';
export interface PreferenceScope{userId:string;organizationId:string;workspaceId:string;}
export interface UiPreference{id:string;user_id:string;organization_id:string;workspace_id:string;theme:ThemeId;version:number;created_at:Date;updated_at:Date;}
export interface UiPreferenceView{theme:ThemeId;source:PreferenceSource;organization_id:string;workspace_id:string;version:number;updated_at:string|null;}
export interface PreferenceAudit{id:string;preference_id:string;user_id:string;organization_id:string;workspace_id:string;action:'ui_preference.created'|'ui_preference.updated';previous_theme:ThemeId|null;theme:ThemeId;request_id:string;trace_id:string;occurred_at:Date;schema_version:1;}
export interface PreferenceOperation{user_id:string;organization_id:string;workspace_id:string;key_hash:string;request_hash:string;preference_id:string;preference_version:number;created_at:Date;}
export interface PreferenceReplay{request_hash:string;preference:UiPreference;}
export interface UiPreferenceRepository{
 resolveScope(sessionId:string,userId:string):Promise<PreferenceScope|null>;
 find(scope:PreferenceScope):Promise<UiPreference|null>;
 findOperation(scope:PreferenceScope,keyHash:string):Promise<PreferenceReplay|null>;
 commit(preference:UiPreference,expectedVersion:number|null,audit:PreferenceAudit,operation:PreferenceOperation):Promise<boolean>;
}
export class PreferenceError extends Error{constructor(readonly code:string,readonly statusCode:number,readonly actionHint:string){super(code);this.name='PreferenceError';}}
export interface PreferenceContext extends PreferenceScope{requestId:string;traceId:string;idempotencyKey:string;}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export function isThemeId(value:unknown):value is ThemeId{return typeof value==='string'&&THEME_IDS.includes(value as ThemeId);}
export class UiPreferenceService{
 constructor(private readonly repository:UiPreferenceRepository,private readonly now:()=>Date=()=>new Date()){}
 async scope(sessionId:string,userId:string){const scope=await this.repository.resolveScope(sessionId,userId);if(!scope)throw new PreferenceError('preference_scope_required',409,'先选择本人有权访问的组织与工作区。');return scope;}
 async get(scope:PreferenceScope):Promise<UiPreferenceView>{const saved=await this.repository.find(scope);return saved?this.view(saved,'saved'):{theme:'deep-ocean',source:'default',organization_id:scope.organizationId,workspace_id:scope.workspaceId,version:0,updated_at:null};}
 async update(input:{theme:unknown;expectedVersion:number},context:PreferenceContext):Promise<UiPreferenceView>{
  if(!isThemeId(input.theme))throw new PreferenceError('theme_invalid',400,'选择 deep-ocean、aurora-purple 或 cloud-white。');
  if(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)throw new PreferenceError('preference_version_invalid',400,'提交当前偏好版本。');
  if(!context.idempotencyKey.trim()||context.idempotencyKey.length>128)throw new PreferenceError('idempotency_key_required',400,'提供 1 至 128 字符的 Idempotency-Key。');
  const keyHash=hash(context.idempotencyKey),requestHash=hash(JSON.stringify({theme:input.theme,expected_version:input.expectedVersion}));
  const replay=await this.repository.findOperation(context,keyHash);if(replay){if(replay.request_hash!==requestHash)throw new PreferenceError('idempotency_conflict',409,'此 Idempotency-Key 已用于不同请求。');return this.view(replay.preference,'saved');}
  const current=await this.repository.find(context);const expected=current?.version??0;if(input.expectedVersion!==expected)throw new PreferenceError('preference_version_conflict',409,'刷新主题偏好后按最新版本重试。');
  const now=this.now(),preference:UiPreference=current?{...current,theme:input.theme,version:current.version+1,updated_at:now}:{id:randomUUID(),user_id:context.userId,organization_id:context.organizationId,workspace_id:context.workspaceId,theme:input.theme,version:1,created_at:now,updated_at:now};
  const audit:PreferenceAudit={id:randomUUID(),preference_id:preference.id,user_id:context.userId,organization_id:context.organizationId,workspace_id:context.workspaceId,action:current?'ui_preference.updated':'ui_preference.created',previous_theme:current?.theme??null,theme:preference.theme,request_id:context.requestId,trace_id:context.traceId,occurred_at:now,schema_version:1};
  const operation:PreferenceOperation={user_id:context.userId,organization_id:context.organizationId,workspace_id:context.workspaceId,key_hash:keyHash,request_hash:requestHash,preference_id:preference.id,preference_version:preference.version,created_at:now};
  if(!await this.repository.commit(preference,current?.version??null,audit,operation)){const concurrent=await this.repository.findOperation(context,keyHash);if(concurrent?.request_hash===requestHash)return this.view(concurrent.preference,'saved');throw new PreferenceError('preference_version_conflict',409,'刷新主题偏好后按最新版本重试。');}
  return this.view(preference,'saved');
 }
 private view(value:UiPreference,source:PreferenceSource):UiPreferenceView{return{theme:value.theme,source,organization_id:value.organization_id,workspace_id:value.workspace_id,version:value.version,updated_at:value.updated_at.toISOString()};}
}

export class InMemoryUiPreferenceRepository implements UiPreferenceRepository{
 scopes=new Map<string,PreferenceScope>();preferences=new Map<string,UiPreference>();operations=new Map<string,{request_hash:string;preference_id:string}>();audits:PreferenceAudit[]=[];
 private scopeKey(scope:PreferenceScope){return`${scope.userId}:${scope.organizationId}:${scope.workspaceId}`;}
 async resolveScope(sessionId:string,userId:string){const scope=this.scopes.get(sessionId);return scope?.userId===userId?scope:null;}
 async find(scope:PreferenceScope){return this.preferences.get(this.scopeKey(scope))??null;}
 async findOperation(scope:PreferenceScope,keyHash:string){const op=this.operations.get(`${this.scopeKey(scope)}:${keyHash}`),preference=op&&[...this.preferences.values()].find(item=>item.id===op.preference_id);return op&&preference?{request_hash:op.request_hash,preference}:null;}
 async commit(preference:UiPreference,expectedVersion:number|null,audit:PreferenceAudit,operation:PreferenceOperation){const key=this.scopeKey({userId:preference.user_id,organizationId:preference.organization_id,workspaceId:preference.workspace_id}),current=this.preferences.get(key);if((current?.version??null)!==expectedVersion)return false;this.preferences.set(key,preference);this.audits.push(audit);this.operations.set(`${key}:${operation.key_hash}`,{request_hash:operation.request_hash,preference_id:preference.id});return true;}
}
