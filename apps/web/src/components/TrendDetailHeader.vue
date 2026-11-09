<script setup lang="ts">
import { computed } from "vue";
import { statusLabel } from "../ui/status-labels";
import AppIcon from "./AppIcon.vue";
import ResearchThumbnail from "./ResearchThumbnail.vue";
import UiStatePanel from "./UiStatePanel.vue";
import type { TrendDetail, TrendTopic } from "./trend-workspace-types";

const props = defineProps<{
  detail: TrendDetail | null;
  busy: string;
  showOverviewTitle: boolean;
  listMedia?: Pick<TrendTopic, "image_url" | "source_url">;
}>();
const emit = defineEmits<{ back: [] }>();
const media = computed(() => ({
  imageUrl: props.detail?.image_url ?? props.listMedia?.image_url,
  sourceUrl: props.detail?.source_url ?? props.listMedia?.source_url,
}));
const overviewEvidenceTitle = computed(() => {
  const title = props.detail?.evidence[0]?.title?.trim();
  return title && title !== props.detail?.title.trim() ? title : "";
});
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
  <header>
    <div>
      <button
        class="trend-detail-back so-action-quiet"
        type="button"
        aria-label="关闭详情 · 返回情报列表"
        title="关闭详情"
        @click="emit('back')"
      >
        <AppIcon class="trend-detail-close-icon" name="x" :size="20" />
        <span>关闭详情<span class="trend-detail-back-suffix"> · 返回情报列表</span></span>
      </button>
      <div v-if="detail && busy !== 'detail'" class="trend-detail-badges">
        <ResearchThumbnail
          v-if="media.imageUrl || media.sourceUrl"
          class="trend-detail-thumbnail"
          :src="media.imageUrl"
          :source-url="media.sourceUrl"
          :alt="media.imageUrl ? '情报商品图' : '情报来源'"
        />
        <span><AppIcon name="map-pin" :size="16" />{{ detail.market }}</span
        ><span><AppIcon name="globe" :size="16" />{{ detail.language }}</span
        ><span :data-status="detail.status">{{ statusLabel(detail.status) }}</span>
      </div>
      <h3 v-if="detail && busy !== 'detail'">{{ detail.title }}</h3>
      <p
        v-if="busy !== 'detail' && showOverviewTitle && overviewEvidenceTitle"
        class="trend-overview-evidence-title"
        :title="overviewEvidenceTitle"
      >
        {{ overviewEvidenceTitle }}
      </p>
      <span v-if="detail && busy !== 'detail'" class="trend-detail-freshness"
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
      <dt><AppIcon name="activity" :size="16" />信号</dt>
      <dd>{{ detail.signal_count }} 条</dd>
    </div>
    <div>
      <dt><AppIcon name="layers" :size="16" />来源</dt>
      <dd>{{ detail.source_count }} 个</dd>
    </div>
    <div>
      <dt><AppIcon name="file" :size="16" />证据</dt>
      <dd>{{ detail.data_quality.evidence_count }} 条</dd>
    </div>
    <div>
      <dt><AppIcon name="shield" :size="16" />可信度</dt>
      <dd :data-insufficient="detail.confidence.status === 'insufficient_data'">
        {{
          detail.confidence.status === "insufficient_data"
            ? "数据不足"
            : `${detail.confidence.score} / 100`
        }}
      </dd>
    </div>
  </dl>
  <p v-else>未取得情报详情，可关闭后重新选择该主题。</p>
</template>
