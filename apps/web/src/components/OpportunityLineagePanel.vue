<script setup lang="ts">
import { computed } from "vue";
import { durationLabel } from "../ui/status-labels";
import type { OpportunityDetail } from "./opportunity-workspace-types";
import { opportunityStatusLabel } from "./opportunity-workspace-presentation";

const props = defineProps<{ lineage: OpportunityDetail["lineage"] }>();

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
const timestamp = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
const nodeGroups = computed(() => {
  const grouped = new Map<string, OpportunityDetail["lineage"]["nodes"]>();
  for (const node of props.lineage.nodes) {
    const group = grouped.get(node.kind) ?? [];
    group.push(node);
    grouped.set(node.kind, group);
  }
  return [...grouped].map(([kind, nodes]) => ({ kind, label: kindLabel(kind), nodes }));
});
</script>

<template>
  <section class="opportunity-lineage opportunity-lineage--c">
    <header>
      <div>
        <p>端到端事实链</p>
        <h4>业务血缘追踪</h4>
        <span>按系统返回的业务类型分组；仅列出已有记录，不推断缺失节点或因果关系。</span>
      </div>
      <b :data-impact="lineage.failure_impact.level">
        {{ impactLabel(lineage.failure_impact.level) }}
      </b>
    </header>

    <dl class="opportunity-lineage-summary">
      <div>
        <dt>最新原始证据</dt>
        <dd v-if="lineage.freshness.observed_at">
          {{ timestamp(lineage.freshness.observed_at) }}
        </dd>
        <dd v-else>尚无原始证据观测时间</dd>
      </div>
      <div>
        <dt>距观测时间</dt>
        <dd v-if="lineage.freshness.age_seconds !== null">
          {{ durationLabel(lineage.freshness.age_seconds) }}
        </dd>
        <dd v-else>距今时间未提供</dd>
      </div>
      <div>
        <dt>受影响环节</dt>
        <dd>{{ lineage.failure_impact.affected_stages.map(kindLabel).join("、") || "无" }}</dd>
      </div>
      <div>
        <dt>返回节点</dt>
        <dd>{{ lineage.nodes.length }} 条；不代表完整历史</dd>
      </div>
    </dl>

    <aside v-if="lineage.failure_impact.codes.length" class="opportunity-lineage-impact">
      <strong>当前返回的失败或降级状态</strong>
      <ul>
        <li v-for="code in lineage.failure_impact.codes" :key="code">
          {{ opportunityStatusLabel(code) }}
        </li>
      </ul>
    </aside>

    <p v-if="!lineage.nodes.length" class="opportunity-empty-copy">
      当前机会尚无可追踪的业务节点；读取结果不代表源系统不存在历史记录。
    </p>
    <ol v-else class="opportunity-lineage-groups">
      <li v-for="group in nodeGroups" :key="group.kind">
        <header>
          <strong>{{ group.label }}</strong>
          <span>{{ group.nodes.length }} 条返回记录</span>
        </header>
        <ol>
          <li v-for="node in group.nodes" :key="node.kind + ':' + node.id">
            <div class="opportunity-lineage-node-heading">
              <strong>{{ node.label }}</strong>
              <span>{{ opportunityStatusLabel(node.status) }}</span>
            </div>
            <p>{{ timestamp(node.occurred_at) }}</p>
            <details>
              <summary>记录标识与导航</summary>
              <dl>
                <div>
                  <dt>资源 ID</dt>
                  <dd>
                    <code>{{ node.id }}</code>
                  </dd>
                </div>
                <div>
                  <dt>request_id</dt>
                  <dd>
                    <code>{{ node.request_id ?? "未记录" }}</code>
                  </dd>
                </div>
                <div>
                  <dt>trace_id</dt>
                  <dd>
                    <code>{{ node.trace_id ?? "未记录" }}</code>
                  </dd>
                </div>
                <div>
                  <dt>来源路由</dt>
                  <dd>
                    <code>{{ node.route }}</code>
                  </dd>
                </div>
              </dl>
              <RouterLink :to="node.route">打开关联记录</RouterLink>
            </details>
          </li>
        </ol>
      </li>
    </ol>

    <details class="opportunity-lineage-correlation">
      <summary>全局关联标识</summary>
      <div>
        <section>
          <strong>request_id</strong>
          <code v-for="id in lineage.request_ids" :key="id">{{ id }}</code>
          <span v-if="!lineage.request_ids.length">未提供</span>
        </section>
        <section>
          <strong>trace_id</strong>
          <code v-for="id in lineage.trace_ids" :key="id">{{ id }}</code>
          <span v-if="!lineage.trace_ids.length">未提供</span>
        </section>
      </div>
    </details>
  </section>
</template>
