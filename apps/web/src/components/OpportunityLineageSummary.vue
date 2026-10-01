<script setup lang="ts">
import { durationLabel } from "../ui/status-labels";

defineProps<{
  observedAt: string | null;
  ageSeconds: number | null;
  affectedStages: string;
  nodeCount: number;
}>();

function timestamp(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
</script>

<template>
  <dl class="opportunity-lineage-summary">
    <div>
      <dt>最新原始证据</dt>
      <dd v-if="observedAt">{{ timestamp(observedAt) }}</dd>
      <dd v-else>尚无原始证据观测时间</dd>
    </div>
    <div>
      <dt>距观测时间</dt>
      <dd v-if="ageSeconds !== null">{{ durationLabel(ageSeconds) }}</dd>
      <dd v-else>距今时间未提供</dd>
    </div>
    <div>
      <dt>受影响环节</dt>
      <dd>{{ affectedStages || "无" }}</dd>
    </div>
    <div>
      <dt>返回节点</dt>
      <dd>{{ nodeCount }} 条；不代表完整历史</dd>
    </div>
  </dl>
</template>
