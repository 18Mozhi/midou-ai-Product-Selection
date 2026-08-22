<script setup lang="ts">
import { RouterLink } from "vue-router";
import { statusLabel } from "../ui/status-labels";
import TrendEvidenceTimeline from "./TrendEvidenceTimeline.vue";
import type { TrendDetail } from "./trend-workspace-types";

defineProps<{
  detail: TrendDetail;
  busy: string;
  qualityIssueIds: Record<string, string>;
  opportunityRoute: string;
}>();
const emit = defineEmits<{
  follow: [];
  createRule: [];
  changeRelevance: [status: "active" | "irrelevant"];
  reportAnomaly: [item: TrendDetail["evidence"][number]];
}>();
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
  <article class="trend-detail" :aria-busy="busy === 'detail'">
    <header>
      <div>
        <a href="#trend-list">← 返回趋势列表</a>
        <p>{{ statusLabel(detail.status) }} · {{ detail.market }} · {{ detail.language }}</p>
        <h3>{{ detail.title }}</h3>
        <span
          >首次 {{ freshness(detail.first_seen_at) }} · 最近来源
          {{ freshness(detail.source_fresh_at) }}</span
        >
      </div>
      <div class="heat-summary">
        <b>{{ detail.heat.value }}</b
        ><small>实际信号数</small>
      </div>
    </header>
    <div class="trend-actions">
      <button type="button" @click="emit('follow')">
        {{ detail.followed ? "已关注" : "关注" }}</button
      ><button type="button" @click="emit('createRule')">创建监控</button
      ><RouterLink :to="opportunityRoute">转为机会</RouterLink
      ><button
        v-if="detail.status !== 'irrelevant'"
        class="quiet"
        type="button"
        @click="emit('changeRelevance', 'irrelevant')"
      >
        标记无关</button
      ><button v-else class="quiet" type="button" @click="emit('changeRelevance', 'active')">
        恢复为相关
      </button>
    </div>
    <section class="trend-conclusion">
      <div>
        <p>可验证结论</p>
        <strong
          >该主题包含 {{ detail.signal_count }} 条信号，来自
          {{ detail.source_count }} 个来源。</strong
        ><span v-if="detail.confidence.status === 'insufficient_data'"
          >置信度：数据不足；不会用默认分数代替。</span
        ><span v-else>置信度 {{ detail.confidence.score }} / 100</span>
      </div>
      <dl>
        <div>
          <dt>证据覆盖</dt>
          <dd>{{ detail.data_quality.evidence_count }} 条</dd>
        </div>
        <div>
          <dt>数据状态</dt>
          <dd>{{ detail.data_quality.coverage_status }}</dd>
        </div>
        <div>
          <dt>环比</dt>
          <dd>
            {{ detail.momentum_percent == null ? "数据不足" : `${detail.momentum_percent}%` }}
          </dd>
        </div>
      </dl>
    </section>
    <TrendEvidenceTimeline
      :detail="detail"
      :busy="busy"
      :quality-issue-ids="qualityIssueIds"
      @report-anomaly="emit('reportAnomaly', $event)"
    />
  </article>
</template>
