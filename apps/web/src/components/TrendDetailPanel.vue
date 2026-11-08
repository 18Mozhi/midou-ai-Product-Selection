<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from "vue";
import { statusLabel } from "../ui/status-labels";
import AppIcon from "./AppIcon.vue";
import ResearchThumbnail from "./ResearchThumbnail.vue";
import UiStatePanel from "./UiStatePanel.vue";
import TrendEvidenceTimeline from "./TrendEvidenceTimeline.vue";
import type { TrendDetail, TrendTopic } from "./trend-workspace-types";

const props = defineProps<{
  detail: TrendDetail | null;
  busy: string;
  canReadRelated: boolean;
  listMedia?: Pick<TrendTopic, "image_url" | "source_url">;
}>();
const emit = defineEmits<{
  back: [];
}>();
const tabs = [
  { key: "overview", label: "情报概览" },
  { key: "evidence", label: "来源证据" },
  { key: "related", label: "关联选品" },
] as const;
const activeTab = ref<(typeof tabs)[number]["key"]>("overview");
const tabList = ref<HTMLElement | null>(null);
const media = computed(() => ({
  imageUrl: props.detail?.image_url ?? props.listMedia?.image_url,
  sourceUrl: props.detail?.source_url ?? props.listMedia?.source_url,
}));
const overviewEvidenceTitle = computed(() => {
  const title = props.detail?.evidence[0]?.title?.trim();
  return title && title !== props.detail?.title.trim() ? title : "";
});
async function showSources() {
  activeTab.value = "evidence";
  await nextTick();
  tabList.value?.querySelector<HTMLElement>('button[aria-selected="true"]')?.focus();
}
defineExpose({ showSources });
const tabId = useId();
const panelId = (key: string) => tabId + (key === "evidence" ? "-evidence" : "-related");
watch(
  () => props.detail?.id,
  () => (activeTab.value = "overview"),
);
function moveTab(event: KeyboardEvent, index: number) {
  const offsets: Record<string, number> = {
    ArrowLeft: (index + tabs.length - 1) % tabs.length,
    ArrowRight: (index + 1) % tabs.length,
    Home: 0,
    End: tabs.length - 1,
  };
  const next = offsets[event.key];
  if (!Object.hasOwn(offsets, event.key) || next === undefined) return;
  const tab = tabs[next];
  if (!tab) return;
  event.preventDefault();
  activeTab.value = tab.key;
  (event.currentTarget as HTMLElement).parentElement?.querySelectorAll("button")[next]?.focus();
}
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
          v-if="busy !== 'detail' && activeTab === 'overview' && overviewEvidenceTitle"
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
    <template v-if="detail && busy !== 'detail'">
      <div ref="tabList" class="trend-detail-tabs" role="tablist" aria-label="情报详情视图">
        <button
          v-for="(tab, index) in tabs"
          :id="tabId + '-' + tab.key"
          :key="tab.key"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.key"
          :aria-controls="panelId(tab.key)"
          :tabindex="activeTab === tab.key ? 0 : -1"
          @click="activeTab = tab.key"
          @keydown="moveTab($event, index)"
        >
          {{ tab.label }}
        </button>
      </div>
      <div
        v-show="activeTab !== 'evidence'"
        :data-overview="activeTab === 'overview'"
        :id="panelId('related')"
        :aria-labelledby="tabId + '-' + (activeTab === 'related' ? 'related' : 'overview')"
        role="tabpanel"
        tabindex="0"
      >
        <slot name="related-products" />
        <p v-if="activeTab === 'related' && !canReadRelated" class="trend-panel-note">
          当前权限下不可查看关联选品。
        </p>
        <p v-else-if="activeTab === 'overview' && !canReadRelated" class="trend-panel-note">
          可切换到「来源证据」查看该主题的原始资料。
        </p>
        <dl v-if="activeTab === 'overview'" class="trend-detail-secondary" aria-label="补充指标">
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
      </div>
      <div
        v-show="activeTab === 'evidence'"
        :id="panelId('evidence')"
        :aria-labelledby="tabId + '-evidence'"
        role="tabpanel"
        tabindex="0"
      >
        <TrendEvidenceTimeline :detail="detail" />
      </div>
    </template>
  </article>
</template>
