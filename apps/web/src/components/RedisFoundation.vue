<script setup lang="ts">
import { computed, ref } from "vue";

type PreviewState = "available" | "unavailable" | "recovering";
const requested = new URLSearchParams(window.location.search).get("state");
const state = ref<PreviewState>(
  requested === "unavailable" || requested === "recovering"
    ? requested
    : "available",
);
const copy = computed(
  () =>
    ({
      available: [
        "可用 · 可连接",
        "依赖连接可用",
        "真实健康结果由后端就绪检查返回；本页不读取主机、密码或队列内容。",
      ],
      unavailable: [
        "不可用 · 已阻塞",
        "缓存服务依赖不可用",
        "停止依赖缓存服务的操作，保留关联编号与链路编号，并按处置手册在宝塔检查服务。",
      ],
      recovering: [
        "恢复中 · 恢复检查",
        "等待有限重试完成",
        "连接恢复后先执行隔离读写与清理检查，再恢复缓存、队列、限流和 SSE 协调。",
      ],
    })[state.value],
);
</script>

<template>
  <header class="topbar">
    <div>
      <p class="eyebrow">系统设置</p>
      <h1>缓存服务基座</h1>
    </div>
    <span class="environment">契约状态预览 · 非实时监控</span>
  </header>
  <section
    class="status-card"
    :data-state="
      state === 'available'
        ? 'ready'
        : state === 'unavailable'
          ? 'error'
          : 'loading'
    "
    aria-live="polite"
  >
    <div class="status-heading">
      <span class="status-dot" aria-hidden="true"></span>
      <div>
        <p class="status-kicker">{{ copy[0] }}</p>
        <h2>{{ copy[1] }}</h2>
      </div>
    </div>
    <div class="state-panel redis-state">
      <p>{{ copy[2] }}</p>
      <div class="state-actions" aria-label="状态预览">
        <button type="button" @click="state = 'available'">可连接</button
        ><button type="button" @click="state = 'unavailable'">依赖失败</button
        ><button type="button" @click="state = 'recovering'">恢复中</button>
      </div>
    </div>
  </section>
  <section
    class="verification-grid config-grid"
    aria-label="缓存服务用途和过期策略"
  >
    <article>
      <span class="state-label state-label--passed">缓存 · 300 秒</span>
      <h3>缓存</h3>
      <p>默认 5 分钟，最长 1 小时；数据库始终是事实源。</p>
    </article>
    <article>
      <span class="state-label state-label--passed">队列 · 24 小时</span>
      <h3>队列与租约</h3>
      <p>默认 24 小时，最长 7 天；任务载荷强制组织与工作区范围。</p>
    </article>
    <article>
      <span class="state-label state-label--blocked">限流 · 60 秒</span>
      <h3>限流</h3>
      <p>首次计数原子设置 TTL，窗口最长 1 小时，不产生永久键。</p>
    </article>
    <article>
      <span class="state-label state-label--blocked">实时事件 · 24 小时</span>
      <h3>SSE 协调</h3>
      <p>按总纲保留 24 小时协调窗口，事件只触发授权范围内的数据失效。</p>
    </article>
  </section>
  <section class="verification-footnote">
    <strong>隔离键格式</strong>
    <p>
      <code
        >scoutops:v1:&lt;purpose&gt;:org:&lt;organization_id&gt;:ws:&lt;workspace_id&gt;:…</code
      >。页面不会显示实际组织、键值、连接地址或凭证。
    </p>
  </section>
</template>
