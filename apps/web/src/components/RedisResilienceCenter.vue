<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { RedisResilienceDto } from "@scoutops/contracts";
import "../redis-resilience.css";

type ViewState = "loading"|"ready"|"warning"|"blocked"|"empty"|"forbidden"|"expired"|"rate_limited"|"unavailable"|"recovering";
const props = defineProps<{apiBaseUrl:string}>();
const state = ref<ViewState>("loading"), data = ref<RedisResilienceDto|null>(null), requestId = ref(""), actionHint = ref("");
const verdict = computed(() => ({
  loading:["正在读取单 Redis 运行事实","核对持久化、内存上限、连接上限与最近错误。"], ready:["单 Redis 韧性门已满足","AOF/RDB、资源上限和失败关闭规则均通过。"],
  warning:["Redis 资源接近预警线","当前仍可用，但需检查增长、积压和连接使用。"], blocked:["Redis 韧性门已阻断","停止依赖 Redis 的新操作，并通过宝塔按阻断项恢复。"],
  empty:["尚无 Redis 观测","确认宝塔 Redis 与 Node API 已运行后重新核验。"], forbidden:["没有平台运维权限",actionHint.value||"需要 platform:operate 能力。"],
  expired:["登录已失效","重新登录后再核验 Redis 韧性。"], rate_limited:["刷新过于频繁","稍后重试；现有结论不会因此升级。"],
  unavailable:["Redis 运行事实暂不可用",actionHint.value||"在宝塔检查 API、MySQL 与 Redis 日志。"], recovering:["正在执行恢复核验","宝塔重启后先验证 PING、持久化、隔离读写与清理。"],
} satisfies Record<ViewState,[string,string]>)[state.value]);
const percent = (basis?:number) => basis === undefined ? "—" : `${(basis/100).toFixed(1)}%`;
const bytes = (value?:number) => value === undefined ? "—" : value >= 1073741824 ? `${(value/1073741824).toFixed(1)} GiB` : `${(value/1048576).toFixed(1)} MiB`;
const time = (value?:string) => value ? new Date(value).toLocaleString("zh-CN",{hour12:false}) : "尚无记录";

async function load() {
  state.value="loading"; actionHint.value="";
  try {
    const response=await fetch(`${props.apiBaseUrl}/platform/operations/redis`,{credentials:"include",headers:{accept:"application/json"}});
    const body=await response.json().catch(()=>null); requestId.value=body?.request_id??""; actionHint.value=body?.error?.action_hint??"";
    if(!response.ok){state.value=response.status===401?"expired":response.status===403?"forbidden":response.status===429?"rate_limited":"unavailable";return;}
    if(!body?.data){data.value=null;state.value="empty";return;}
    data.value=body.data;state.value=body.data.state;
  } catch { state.value="unavailable"; }
}
onMounted(load);
</script>

<template>
  <section class="redis-resilience" :data-state="state">
    <header class="redis-resilience__hero"><div><p>SINGLE REDIS</p><h2>Redis 单实例韧性</h2><span>当前惠州单机只运行一个宝塔 Redis；不启用 Sentinel、集群、副本或备用服务器。</span></div><button type="button" @click="load">刷新运行事实</button></header>
    <section v-if="state==='loading'||state==='recovering'" class="redis-resilience__state" aria-live="polite"><i aria-hidden="true"></i><div><b>{{verdict[0]}}</b><p>{{verdict[1]}}</p></div></section>
    <section v-else-if="['forbidden','expired','rate_limited','unavailable','empty'].includes(state)" class="redis-resilience__state redis-resilience__state--danger" aria-live="polite"><strong aria-hidden="true">!</strong><div><b>{{verdict[0]}}</b><p>{{verdict[1]}}</p><code v-if="requestId">request_id {{requestId}}</code></div><a v-if="state==='expired'" href="/login">重新登录</a><button v-else type="button" @click="load">重新核验</button></section>
    <template v-else-if="data">
      <section class="redis-resilience__verdict" :data-verdict="state"><div><small>S0 · {{state.toUpperCase()}}</small><strong>{{verdict[0]}}</strong></div><p>{{verdict[1]}}</p><em>单实例 · 运行状态已核对</em></section>
      <section class="redis-resilience__metrics" aria-label="Redis 资源指标">
        <article><span>内存使用</span><strong>{{percent(data.memory.usage_basis_points)}}</strong><small>{{bytes(data.memory.used_bytes)}} / {{bytes(data.memory.max_bytes)}}</small></article>
        <article><span>连接使用</span><strong>{{percent(data.connections.usage_basis_points)}}</strong><small>{{data.connections.connected}} / {{data.connections.maximum}}</small></article>
        <article><span>拒绝连接</span><strong>{{data.connections.rejected}}</strong><small>任何非零均阻断</small></article>
        <article><span>淘汰键</span><strong>{{data.evicted_keys}}</strong><small>noeviction · 不静默丢弃</small></article>
      </section>
      <div class="redis-resilience__layout">
        <section class="redis-resilience__panel redis-resilience__persistence"><header><div><p>PERSISTENCE</p><h3>双持久化状态</h3></div><span>宝塔管理</span></header><div class="redis-resilience__persistence-grid"><article :data-ok="data.persistence.aof_enabled&&data.persistence.aof_last_write_status==='ok'"><i>AOF</i><b>{{data.persistence.aof_enabled?'已启用':'未启用'}}</b><small>everysec · {{data.persistence.aof_last_write_status}}</small></article><article :data-ok="data.persistence.rdb_enabled&&data.persistence.rdb_last_save_status==='ok'"><i>RDB</i><b>{{data.persistence.rdb_enabled?'已启用':'未启用'}}</b><small>定时快照 · {{data.persistence.rdb_last_save_status}}</small></article></div><p>Redis 只保存缓存、队列、限流与 SSE 协调；MySQL 仍是事实源。</p></section>
        <aside class="redis-resilience__panel"><header><div><p>RUNTIME</p><h3>运行方式</h3></div></header><dl><div><dt>运行模式</dt><dd>单实例</dd></div><div><dt>Sentinel</dt><dd>{{data.sentinel_enabled?'已启用':'未启用'}}</dd></div><div><dt>Redis 集群</dt><dd>{{data.cluster_enabled?'已启用':'未启用'}}</dd></div><div><dt>事实来源</dt><dd>宝塔受管实例</dd></div></dl></aside>
      </div>
      <section class="redis-resilience__panel redis-resilience__findings"><header><div><p>FAIL-CLOSED GATES</p><h3>告警与阻断项</h3></div><span>{{data.findings.length}} 项</span></header><div v-if="data.findings.length"><article v-for="(item,index) in data.findings" :key="item.code" :data-severity="item.severity"><span>{{String(index+1).padStart(2,'0')}}</span><code>{{item.code}}</code><p>{{item.action_hint}}</p></article></div><div v-else class="redis-resilience__clear"><b>当前无 Redis 韧性阻断</b><span>持久化、连接、队列与限流功能均处于可用状态。</span></div></section>
      <footer class="redis-resilience__footer"><span>观测 {{time(data.observed_at)}}</span><span>request_id {{requestId||'—'}}</span><strong>重启、配置与恢复只允许通过宝塔</strong></footer>
    </template>
  </section>
</template>
