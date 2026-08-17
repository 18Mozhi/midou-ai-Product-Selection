<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
const props=defineProps<{apiBaseUrl:string}>();type State='loading'|'ready'|'error';const state=ref<State>('loading');const requestId=ref('');
const copy=computed(()=>state.value==='loading'?['CHECKING · 检查中','正在验证同步依赖']:state.value==='ready'?['READY · 可承载同步流量','API readiness 通过']:['UNAVAILABLE · 已阻塞','API 依赖暂不可用']);
async function check(){state.value='loading';const id=crypto.randomUUID();requestId.value=id;try{const response=await fetch(`${props.apiBaseUrl}/health/ready`,{headers:{accept:'application/json','x-request-id':id}});const body=await response.json();if(!response.ok||body.data?.status!=='ready')throw new Error('not_ready');state.value='ready';}catch{state.value='error';}}
onMounted(check);
</script>
<template>
  <header class="topbar"><div><p class="eyebrow">SYSTEM SETTINGS</p><h1>API 基座</h1></div><span class="environment">同步职责 readiness</span></header>
  <section class="status-card" :data-state="state" aria-live="polite"><div class="status-heading"><span class="status-dot" aria-hidden="true"></span><div><p class="status-kicker">{{copy[0]}}</p><h2>{{copy[1]}}</h2></div></div>
    <div v-if="state==='loading'" class="state-panel" data-testid="api-loading"><span class="spinner" aria-hidden="true"></span><p>检查必需配置、MySQL 与 Redis；不检查 Worker、Crawler 或第三方来源。</p></div>
    <div v-else-if="state==='ready'" class="state-panel" data-testid="api-ready"><p>MySQL 与 Redis 均可用。响应只返回依赖类别，不暴露地址、账号、密码、库表或键。</p></div>
    <div v-else class="state-panel state-panel--error" data-testid="api-error"><div><strong>依赖检查失败</strong><p>稍后重试；运维人员在宝塔检查 MySQL 与 Redis。</p><small>请求标识：{{requestId}}</small></div><button type="button" @click="check">重新检查</button></div>
  </section>
  <section class="verification-grid config-grid" aria-label="API 基础合同"><article><span class="state-label state-label--passed">REQUEST / TRACE</span><h3>全链路标识</h3><p>接受安全的上游 ID，否则生成新值；响应头和错误信封保持一致。</p></article><article><span class="state-label state-label--passed">SCHEMA / OPENAPI</span><h3>合同先行</h3><p>字段不符合 schema 返回稳定 400 错误码与调整方式。</p></article><article><span class="state-label state-label--blocked">AUTH · FAIL CLOSED</span><h3>认证占位不放行</h3><p>只有注入真实 Token verifier 后才产生组织 claims，并再次检查 capability。</p></article><article><span class="state-label state-label--blocked">IDEMPOTENCY</span><h3>写请求幂等</h3><p>幂等键只保存哈希，并与组织范围、路由和方法共同唯一。</p></article></section>
</template>
