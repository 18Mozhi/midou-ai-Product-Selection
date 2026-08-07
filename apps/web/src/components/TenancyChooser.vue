<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { OrganizationMembershipSummary, SelectedTenancyContext, TeamSummary, WorkspaceSummary } from '@scoutops/contracts';

const props=defineProps<{apiBaseUrl:string}>();
type State='loading'|'ready'|'empty'|'error'|'forbidden'|'expired'|'selecting'|'selected';
interface Envelope<T>{data:T;request_id:string;trace_id:string}
const state=ref<State>('loading');const organizations=ref<OrganizationMembershipSummary[]>([]);const workspaces=ref<WorkspaceSummary[]>([]);const teams=ref<TeamSummary[]>([]);const selectedOrganization=ref<OrganizationMembershipSummary|null>(null);const selectedWorkspace=ref<WorkspaceSummary|null>(null);const selectedContext=ref<SelectedTenancyContext|null>(null);const requestId=ref('');
const title=computed(()=>selectedOrganization.value?'选择工作区':'选择组织');
const copy=computed(()=>selectedOrganization.value?`进入 ${selectedOrganization.value.name} 前，选择本次会话使用的工作区。`:'只显示当前账号仍为活动成员的组织。');
async function request<T>(path:string,init?:RequestInit){const response=await fetch(`${props.apiBaseUrl}${path}`,{credentials:'include',headers:{accept:'application/json',...init?.headers},...init});const body=await response.json().catch(()=>null) as Envelope<T>|{error?:{code?:string};request_id?:string}|null;if(!response.ok){requestId.value=body?.request_id??'';if(response.status===401)throw new Error('session_expired');if(response.status===403)throw new Error('forbidden');throw new Error('request_failed');}return(body as Envelope<T>).data;}
const failureState=(error:unknown):State=>error instanceof Error&&error.message==='forbidden'?'forbidden':error instanceof Error&&error.message==='session_expired'?'expired':'error';
async function loadOrganizations(){state.value='loading';selectedOrganization.value=null;selectedWorkspace.value=null;selectedContext.value=null;try{organizations.value=await request('/org/memberships');state.value=organizations.value.length?'ready':'empty';}catch(error){state.value=failureState(error);}}
async function chooseOrganization(organization:OrganizationMembershipSummary){state.value='loading';selectedOrganization.value=organization;try{const[workspaceItems,teamItems]=await Promise.all([request<WorkspaceSummary[]>(`/org/${organization.id}/workspaces`),request<TeamSummary[]>(`/org/${organization.id}/teams`)]);workspaces.value=workspaceItems;teams.value=teamItems;state.value=workspaces.value.length?'ready':'empty';}catch(error){state.value=failureState(error);}}
async function chooseWorkspace(workspace:WorkspaceSummary){if(workspace.status!=='active')return;selectedWorkspace.value=workspace;state.value='selecting';try{selectedContext.value=await request<SelectedTenancyContext>('/auth/context',{method:'POST',headers:{'content-type':'application/json','idempotency-key':crypto.randomUUID()},body:JSON.stringify({organization_id:workspace.organization_id,workspace_id:workspace.id})});state.value='selected';}catch(error){state.value=failureState(error);}}
onMounted(loadOrganizations);
</script>

<template>
  <main class="tenancy-page" data-testid="tenancy">
    <header class="tenancy-header"><a href="/" class="identity-brand"><span>S</span>ScoutOps</a><div><span class="tenancy-step">01</span><i></i><span class="tenancy-step" :class="{'tenancy-step--active':selectedOrganization}">02</span><i></i><span class="tenancy-step">03</span></div><button type="button" class="tenancy-account">当前账号</button></header>
    <section class="tenancy-shell">
      <div class="tenancy-intro"><p>ORGANIZATION CONTEXT</p><h1>{{ title }}</h1><span>{{ copy }}</span></div>
      <div v-if="state==='loading'" class="tenancy-state" aria-live="polite"><span class="spinner"></span><strong>正在读取可用范围</strong><p>组织和工作区会从当前登录会话加载。</p></div>
      <div v-else-if="state==='error'||state==='forbidden'||state==='expired'" class="tenancy-state tenancy-state--error" aria-live="assertive"><b>{{ state==='forbidden'?'403':state==='expired'?'401':'!' }}</b><strong>{{ state==='forbidden'?'无权访问该组织':state==='expired'?'登录已过期':'暂时无法加载' }}</strong><p>{{ state==='forbidden'?'返回组织列表并选择仍有成员资格的组织。':state==='expired'?'重新登录后再选择组织和工作区。':'检查网络或登录状态后重试。' }}</p><small v-if="requestId">请求标识：{{ requestId }}</small><a v-if="state==='expired'" href="/?view=local-identity">重新登录</a><button v-else type="button" @click="loadOrganizations">返回组织列表</button></div>
      <div v-else-if="state==='empty'" class="tenancy-state"><b>○</b><strong>{{ selectedOrganization?'暂无可用工作区':'暂无可用组织' }}</strong><p>{{ selectedOrganization?'请联系组织管理员创建或恢复工作区。':'请联系平台管理员加入组织。' }}</p><button v-if="selectedOrganization" type="button" @click="loadOrganizations">返回组织列表</button></div>
      <div v-else-if="state==='selected'&&selectedContext" class="tenancy-state tenancy-state--selected" aria-live="polite"><b>✓</b><strong>工作范围已就绪</strong><p>{{ selectedContext.organization.name }} · {{ selectedContext.workspace.name }}</p><a href="/">进入 ScoutOps</a></div>
      <template v-else>
        <button v-if="selectedOrganization" type="button" class="tenancy-back" @click="loadOrganizations">← 返回组织</button>
        <div v-if="!selectedOrganization" class="tenancy-grid" aria-label="可用组织">
          <button v-for="organization in organizations" :key="organization.id" type="button" class="tenancy-card" @click="chooseOrganization(organization)"><span class="tenancy-avatar">{{ organization.name.slice(0,1) }}</span><span><strong>{{ organization.name }}</strong><small>{{ organization.slug }} · {{ organization.timezone }}</small></span><em>选择 →</em></button>
        </div>
        <div v-else class="workspace-layout">
          <div class="workspace-grid" aria-label="可用工作区"><button v-for="workspace in workspaces" :key="workspace.id" type="button" class="workspace-card" :disabled="workspace.status!=='active'||state==='selecting'" @click="chooseWorkspace(workspace)"><span>⌁</span><strong>{{ workspace.name }}</strong><small>{{ workspace.status==='active'?'可进入':'已归档' }}</small><em>{{ state==='selecting'&&selectedWorkspace?.id===workspace.id?'正在选择…':'进入工作区 →' }}</em></button></div>
          <aside class="team-summary"><p>组织团队</p><strong>{{ teams.length }}</strong><span>{{ teams.length?'当前组织的团队数量':'当前组织尚未建立团队' }}</span><small>团队成员与角色配置将在权限模块提供。</small></aside>
        </div>
      </template>
    </section>
    <footer class="tenancy-footer"><span>会话范围会被审计记录</span><span>不显示其他组织数据</span></footer>
  </main>
</template>
