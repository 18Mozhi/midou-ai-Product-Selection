<script setup lang="ts">
import { durationLabel, statusLabel } from "../ui/status-labels";
import type { OpportunityDetail } from "./opportunity-workspace-types";

defineProps<{ lineage: OpportunityDetail["lineage"] }>();

const kindLabel = (kind: string) =>
  ({
    source: "来源健康",
    collection_task: "采集任务",
    collection_attempt: "执行尝试",
    evidence: "原始证据",
    quality_issue: "质量问题",
    trend: "趋势",
    opportunity: "机会",
    score: "评分",
    profit: "利润",
    task: "任务",
    notification: "通知",
  })[kind] ?? kind;
const impactLabel = (level: string) =>
  ({ none: "未发现失败影响", degraded: "部分环节降级", blocked: "存在阻断影响" })[level] ?? level;
const freshness = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
</script>

<template>
  <section class="opportunity-lineage">
    <header>
      <div>
        <p>端到端事实链</p>
        <h4>业务血缘追踪</h4>
        <span>每个节点均来自当前工作区的持久化记录；缺失环节保持缺失。</span>
      </div>
      <b :data-impact="lineage.failure_impact.level">
        {{ impactLabel(lineage.failure_impact.level) }}
      </b>
    </header>
    <dl class="opportunity-lineage-summary">
      <div>
        <dt>数据新鲜度</dt>
        <dd v-if="lineage.freshness.observed_at">
          {{ freshness(lineage.freshness.observed_at) }} · 距今
          {{ durationLabel(lineage.freshness.age_seconds ?? 0) }}
        </dd>
        <dd v-else>尚无原始证据观测时间</dd>
      </div>
      <div>
        <dt>失败影响</dt>
        <dd>{{ lineage.failure_impact.affected_stages.map(kindLabel).join("、") || "无" }}</dd>
      </div>
    </dl>
    <p v-if="!lineage.nodes.length" class="opportunity-empty-copy">
      当前机会尚无可追踪的业务节点。
    </p>
    <ol v-else class="opportunity-lineage-list">
      <li v-for="node in lineage.nodes" :key="node.kind + ':' + node.id">
        <span>{{ kindLabel(node.kind) }}</span>
        <div>
          <strong>{{ node.label }}</strong>
          <small
            >{{ freshness(node.occurred_at) }} · {{ statusLabel(node.status.split(":")[0]) }}</small
          >
          <details>
            <summary>技术链路</summary>
            <code>request_id: {{ node.request_id ?? "未记录" }}</code>
            <code>trace_id: {{ node.trace_id ?? "未记录" }}</code>
            <code>resource_id: {{ node.id }}</code>
          </details>
        </div>
        <RouterLink :to="node.route">打开节点</RouterLink>
      </li>
    </ol>
    <details v-if="lineage.failure_impact.codes.length" class="opportunity-lineage-impact">
      <summary>查看失败影响代码</summary>
      <code v-for="code in lineage.failure_impact.codes" :key="code">{{ code }}</code>
    </details>
  </section>
</template>
