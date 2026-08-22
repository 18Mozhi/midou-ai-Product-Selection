<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { TrendDetail } from "./trend-workspace-types";

const props = defineProps<{
  detail: TrendDetail;
  busy: string;
  qualityIssueIds: Record<string, string>;
}>();
const emit = defineEmits<{ reportAnomaly: [item: TrendDetail["evidence"][number]] }>();
const timelineSource = ref("");
const freshness = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
const timelinePoints = computed(() => {
  if (!timelineSource.value) return props.detail.timeline;
  return (
    props.detail.timeline_sources
      .find((source) => source.source_id === timelineSource.value)
      ?.points.map((point) => ({ ...point, source_count: 1 })) ?? []
  );
});
const timelineSourceLabel = computed(
  () =>
    props.detail.timeline_sources.find((source) => source.source_id === timelineSource.value)
      ?.source_label ?? "全部来源",
);
const maxSignal = computed(() =>
  Math.max(1, ...(timelinePoints.value.map((item) => item.signal_count) ?? [1])),
);
watch(
  () => props.detail.id,
  () => (timelineSource.value = ""),
);
</script>

<template>
  <section class="trend-evidence">
    <header>
      <div>
        <p>主要证据</p>
        <h4>主要证据</h4>
      </div>
      <span>来源 {{ detail.source_count }} · 最新 {{ freshness(detail.source_fresh_at) }}</span>
    </header>
    <article v-for="item in detail.evidence" :key="item.id" class="trend-evidence-item">
      <span
        ><strong>{{ item.title }}</strong
        ><small
          >{{ item.publisher }} · 发布 {{ freshness(item.published_at) }} · 采集
          {{ freshness(item.observed_at) }} · 原始来源可核对</small
        ></span
      ><span class="trend-evidence-actions"
        ><a :href="item.canonical_url" target="_blank" rel="noopener noreferrer">查看原文 ↗</a
        ><button
          type="button"
          :disabled="Boolean(busy) || Boolean(qualityIssueIds[item.id])"
          @click="emit('reportAnomaly', item)"
        >
          {{ qualityIssueIds[item.id] ? "已建质量工单" : "报告异常" }}
        </button></span
      >
    </article>
  </section>
  <section class="trend-evidence">
    <header>
      <div>
        <p>相关性回溯</p>
        <h4>标记原因与恢复记录</h4>
      </div>
      <span>{{ detail.relevance_history.length }} 次变更</span>
    </header>
    <p v-if="!detail.relevance_history.length">尚无相关性变更记录。</p>
    <article v-for="item in detail.relevance_history" :key="`${item.version}-${item.occurred_at}`">
      <span
        ><strong>{{ item.status === "irrelevant" ? "标记无关" : "恢复相关" }}</strong
        ><small>{{ freshness(item.occurred_at) }} · 主题 v{{ item.version }}</small></span
      >
      <p>{{ item.reason }}</p>
      <details>
        <summary>技术详情</summary>
        <code>操作者 {{ item.actor_id }}</code>
      </details>
    </article>
  </section>
  <div class="trend-lower">
    <section>
      <header>
        <div>
          <p>信号时间线</p>
          <h4>信号时间线</h4>
        </div>
        <label class="timeline-source-filter"
          >来源筛选<select v-model="timelineSource">
            <option value="">全部来源</option>
            <option
              v-for="source in detail.timeline_sources"
              :key="source.source_id"
              :value="source.source_id"
            >
              {{ source.source_label }}
            </option>
          </select></label
        >
      </header>
      <div
        class="timeline-bars"
        role="img"
        :aria-label="`信号时间线，来源 ${timelineSourceLabel}，共 ${timelinePoints.length} 个时间点`"
      >
        <span v-for="point in timelinePoints" :key="point.at"
          ><i :style="{ height: `${Math.max(12, (point.signal_count / maxSignal) * 100)}%` }"></i
          ><b>{{ point.signal_count }}</b
          ><small>{{ freshness(point.at) }}</small></span
        >
      </div>
    </section>
    <section>
      <header>
        <p>关键词</p>
        <h4>关键词</h4>
      </header>
      <div class="keyword-cloud">
        <span
          v-for="item in detail.keywords"
          :key="`${item.type}-${item.keyword}`"
          :data-type="item.type"
          >{{ item.keyword }}<small>{{ item.type }} · {{ item.market }}</small></span
        >
      </div>
    </section>
  </div>
</template>
