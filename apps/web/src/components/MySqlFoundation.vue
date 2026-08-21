<script setup lang="ts">
import { computed, ref } from "vue";
type PreviewState = "available" | "blocked" | "rollback";
const requested = new URLSearchParams(window.location.search).get("state");
const state = ref<PreviewState>(
  requested === "blocked" || requested === "rollback" ? requested : "available",
);
const copy = computed(
  () =>
    ({
      available: [
        "可用 · 合同通过",
        "数据库 5.7 基座可用",
        "真实门禁要求 product_scout 业务账号、utf8mb4、迁移幂等与事务回滚全部通过。",
      ],
      blocked: [
        "已阻断 · 停止下游",
        "数据库门禁未通过",
        "版本、字符集、业务账号或连接任一不满足时停止依赖模块，不用静态检查冒充成功。",
      ],
      rollback: [
        "回滚 · 逆序恢复",
        "按迁移逆序回滚",
        "先备份与导出迁移元数据，再按 down SQL 逆序执行并复核 checksum 与业务数据。",
      ],
    })[state.value],
);
</script>
<template>
  <header class="topbar">
    <div>
      <p class="eyebrow">系统设置</p>
      <h1>数据库 5.7 基座</h1>
    </div>
    <span class="environment">契约状态预览 · 非实时监控</span>
  </header>
  <section
    class="status-card"
    :data-state="state === 'available' ? 'ready' : state === 'blocked' ? 'error' : 'loading'"
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
        <button type="button" @click="state = 'available'">合同通过</button
        ><button type="button" @click="state = 'blocked'">验收受阻</button
        ><button type="button" @click="state = 'rollback'">回滚中</button>
      </div>
    </div>
  </section>
  <section class="verification-grid config-grid" aria-label="数据库基座合同">
    <article>
      <span class="state-label state-label--passed">数据库 5.7</span>
      <h3>版本锁定</h3>
      <p>拒绝数据库 8 专属语法；生产库与业务账号均使用项目专用账号。</p>
    </article>
    <article>
      <span class="state-label state-label--passed">统一字符集</span>
      <h3>统一字符集</h3>
      <p>表、连接和服务端使用 utf8mb4 / utf8mb4_unicode_ci。</p>
    </article>
    <article>
      <span class="state-label state-label--blocked">迁移校验</span>
      <h3>迁移不可漂移</h3>
      <p>已应用迁移内容变化立即阻断，记录文件名、校验值和 UTC 时间。</p>
    </article>
    <article>
      <span class="state-label state-label--blocked">显式事务</span>
      <h3>显式事务</h3>
      <p>成功提交、失败回滚，连接在 finally 释放；不得跨组织静默写入。</p>
    </article>
  </section>
  <section class="verification-footnote">
    <strong>安全边界</strong>
    <p>
      页面不显示主机、端口、账号、密码、SQL、表数据或其他组织信息。真实依赖状态由统一后端的授权就绪接口返回。
    </p>
  </section>
</template>
