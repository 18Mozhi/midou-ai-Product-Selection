<script setup lang="ts">
import { nextTick, ref, useId, watch } from "vue";
import TrendDetailHeader from "./TrendDetailHeader.vue";
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
</script>

<template>
  <article class="trend-detail" :aria-busy="busy === 'detail'">
    <TrendDetailHeader
      :detail="detail"
      :busy="busy"
      :list-media="listMedia"
      :show-overview-title="activeTab === 'overview'"
      @back="emit('back')"
    />
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
