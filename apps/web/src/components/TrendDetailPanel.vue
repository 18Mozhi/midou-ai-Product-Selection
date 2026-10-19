<script setup lang="ts">
import { statusLabel } from "../ui/status-labels";
import UiStatePanel from "./UiStatePanel.vue";
import TrendEvidenceTimeline from "./TrendEvidenceTimeline.vue";
import type { TrendDetail } from "./trend-workspace-types";

defineProps<{
  detail: TrendDetail;
  busy: string;
}>();
const emit = defineEmits<{
  back: [];
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
        <button class="trend-detail-back so-action-quiet" type="button" @click="emit('back')">
          返回趋势列表
        </button>
        <p v-if="busy !== 'detail'">
          {{ statusLabel(detail.status) }} · {{ detail.market }} · {{ detail.language }}
        </p>
        <h3 v-if="busy !== 'detail'">{{ detail.title }}</h3>
        <span v-if="busy !== 'detail'"
          >首次 {{ freshness(detail.first_seen_at) }} · 最近来源
          {{ freshness(detail.source_fresh_at) }}</span
        >
      </div>
    </header>
    <UiStatePanel
      v-if="busy === 'detail'"
      kind="loading"
      title="正在读取情报证据"
      description="读取完成后显示所选情报的详情。"
      :compact="true"
      :hide-secondary="true"
    />
    <dl v-else class="trend-detail-facts" aria-label="情报资料">
      <div>
        <dt>信号</dt>
        <dd>{{ detail.signal_count }} 条</dd>
      </div>
      <div>
        <dt>来源</dt>
        <dd>{{ detail.source_count }} 个</dd>
      </div>
      <div>
        <dt>证据覆盖</dt>
        <dd>{{ detail.data_quality.evidence_count }} 条</dd>
      </div>
      <div>
        <dt>可信度</dt>
        <dd>
          {{
            detail.confidence.status === "insufficient_data"
              ? "数据不足"
              : `${detail.confidence.score} / 100`
          }}
        </dd>
      </div>
      <div>
        <dt>数据状态</dt>
        <dd>
          {{
            detail.data_quality.coverage_status === "covered"
              ? "已覆盖"
              : detail.data_quality.coverage_status === "insufficient_data"
                ? "数据不足"
                : detail.data_quality.coverage_status
          }}
        </dd>
      </div>
      <div>
        <dt>环比</dt>
        <dd>
          {{ detail.momentum_percent == null ? "数据不足" : `${detail.momentum_percent}%` }}
        </dd>
      </div>
    </dl>
    <slot v-if="busy !== 'detail'" name="related-products" />
    <TrendEvidenceTimeline v-if="busy !== 'detail'" :detail="detail" />
  </article>
</template>
