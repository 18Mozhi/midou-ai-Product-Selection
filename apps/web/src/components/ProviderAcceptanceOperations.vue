<script setup lang="ts">
import type { AcceptanceRunOutcome, AcceptanceSnapshot } from "./provider-1688-acceptance-types";

defineProps<{
  data: AcceptanceSnapshot;
  credentialsLink: string;
  sampleLink: string;
  currentRunState: string;
  readRequestId: string;
  readFailureRequestId: string;
  runOutcome: AcceptanceRunOutcome | null;
}>();
const time = (value: string | null) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "尚无证据";
</script>

<template>
  <div class="acceptance-1688__operations">
    <section class="acceptance-1688__actions">
      <div>
        <p>下一步</p>
        <h3>{{ data.pending_reasons.length ? "按阻塞项逐项收口" : "门禁已全部通过" }}</h3>
      </div>
      <ol v-if="data.pending_reasons.length">
        <li v-for="reason in data.pending_reasons" :key="reason">{{ reason }}</li>
      </ol>
      <p v-else>当前没有待配置原因；由 {{ data.owner_label }} 复核后显式启用来源。</p>
      <nav aria-label="1688 启用检查下一步操作">
        <RouterLink :to="credentialsLink">配置或续期登录档案</RouterLink
        ><RouterLink :to="sampleLink">定位 1688 固定样本</RouterLink>
      </nav>
    </section>
    <section class="acceptance-1688__run">
      <div>
        <p>最近浏览器运行（服务端记录）</p>
        <h3>{{ currentRunState }}</h3>
      </div>
      <dl v-if="data.latest_run">
        <div>
          <dt>开始</dt>
          <dd>{{ time(data.latest_run.started_at) }}</dd>
        </div>
        <div>
          <dt>完成</dt>
          <dd>{{ time(data.latest_run.finished_at) }}</dd>
        </div>
        <div>
          <dt>错误分类</dt>
          <dd>{{ data.latest_run.error_code || "无" }}</dd>
        </div>
      </dl>
      <p v-else>配置有效登录档案后，从真实业务采集任务发起一次 1688 浏览器运行。</p>
      <details>
        <summary>技术详情与读取追踪</summary>
        <code>overall {{ data.overall }}</code
        ><code>来源内部编号：{{ data.provider_id }}</code
        ><code>启用条件读取编号：{{ readRequestId || "—" }}</code
        ><code v-if="readFailureRequestId">本次失败读取编号：{{ readFailureRequestId }}</code
        ><code v-if="runOutcome?.requestId"
          >提交编号独立于启用条件读取编号：{{ runOutcome.requestId }}</code
        >
      </details>
    </section>
  </div>
</template>
