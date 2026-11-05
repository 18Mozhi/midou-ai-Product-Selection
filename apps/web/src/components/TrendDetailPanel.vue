<script setup lang="ts">
import { statusLabel } from "../ui/status-labels";
import AppIcon from "./AppIcon.vue";
import UiStatePanel from "./UiStatePanel.vue";
import TrendEvidenceTimeline from "./TrendEvidenceTimeline.vue";
import type { TrendDetail } from "./trend-workspace-types";

defineProps<{
  detail: TrendDetail | null;
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
          关闭详情 · 返回情报列表
        </button>
        <div v-if="detail && busy !== 'detail'" class="trend-detail-badges">
          <span>{{ detail.market }}</span
          ><span>{{ detail.language }}</span
          ><span :data-status="detail.status">{{ statusLabel(detail.status) }}</span>
        </div>
        <h3 v-if="detail && busy !== 'detail'">{{ detail.title }}</h3>
        <span v-if="detail && busy !== 'detail'"
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
    <dl v-else-if="detail" class="trend-detail-facts" aria-label="情报资料">
      <div>
        <dt><AppIcon name="trend" :size="16" />信号</dt>
        <dd>{{ detail.signal_count }} 条</dd>
      </div>
      <div>
        <dt><AppIcon name="list" :size="16" />来源</dt>
        <dd>{{ detail.source_count }} 个</dd>
      </div>
      <div>
        <dt><AppIcon name="database" :size="16" />证据覆盖</dt>
        <dd>{{ detail.data_quality.evidence_count }} 条</dd>
      </div>
      <div>
        <dt><AppIcon name="shield" :size="16" />可信度</dt>
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
    <p v-else>未取得情报详情，可关闭后重新选择该主题。</p>
    <slot v-if="detail && busy !== 'detail'" name="related-products" />
    <TrendEvidenceTimeline v-if="detail && busy !== 'detail'" :detail="detail" />
  </article>
</template>
