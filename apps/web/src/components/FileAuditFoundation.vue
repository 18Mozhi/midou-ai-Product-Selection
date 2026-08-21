<script setup lang="ts">
import { computed, ref } from "vue";
type State = "protected" | "denied" | "redacted";
const requested = new URLSearchParams(location.search).get("state");
const state = ref<State>(
  requested === "denied" || requested === "redacted" ? requested : "protected",
);
const copy = computed(
  () =>
    ({
      protected: [
        "PROTECTED · 已隔离",
        "文件路径受组织范围保护",
        "所有证据、导出与附件路径同时包含 organization_id 和 workspace_id。",
      ],
      denied: [
        "DENIED · 默认拒绝",
        "下载授权无效",
        "签名、组织、工作区、路径或过期时间任一不匹配时拒绝下载。",
      ],
      redacted: [
        "REDACTED · 已脱敏",
        "审计事件安全记录",
        "保留 actor、action、resource、request_id 与 trace_id；敏感字段替换为 REDACTED。",
      ],
    })[state.value],
);
</script>
<template>
  <header class="topbar">
    <div>
      <p class="eyebrow">系统设置</p>
      <h1>文件与审计基座</h1>
    </div>
    <span class="environment">组织隔离 · 短时授权</span>
  </header>
  <section
    class="status-card"
    :data-state="state === 'protected' ? 'ready' : state === 'denied' ? 'error' : 'loading'"
    aria-live="polite"
  >
    <div class="status-heading">
      <span class="status-dot"></span>
      <div>
        <p class="status-kicker">{{ copy[0] }}</p>
        <h2>{{ copy[1] }}</h2>
      </div>
    </div>
    <div class="state-panel redis-state">
      <p>{{ copy[2] }}</p>
      <div class="state-actions">
        <button @click="state = 'protected'">隔离通过</button
        ><button @click="state = 'denied'">授权拒绝</button
        ><button @click="state = 'redacted'">审计脱敏</button>
      </div>
    </div>
  </section>
  <section class="verification-grid config-grid">
    <article>
      <span class="state-label state-label--passed">路径限定范围</span>
      <h3>路径不可越界</h3>
      <p>拒绝空范围、路径穿越、绝对子路径和不安全文件名。</p>
    </article>
    <article>
      <span class="state-label state-label--passed">原子写入</span>
      <h3>原子落盘</h3>
      <p>先写同目录临时文件，再原子重命名；失败清理临时文件。</p>
    </article>
    <article>
      <span class="state-label state-label--blocked">GRANT · ≤ 300s</span>
      <h3>短时下载</h3>
      <p>HMAC 签名绑定组织、工作区、相对路径、随机值和过期时间。</p>
    </article>
    <article>
      <span class="state-label state-label--blocked">追加审计</span>
      <h3>结构化审计</h3>
      <p>记录前后范围与链路标识，密码、令牌、浏览器凭证与密钥不入日志。</p>
    </article>
  </section>
</template>
