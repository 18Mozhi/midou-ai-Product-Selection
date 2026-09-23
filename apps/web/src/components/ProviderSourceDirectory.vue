<script setup lang="ts">
import { nextTick, ref } from "vue";
import type { ProviderSourceItem } from "./provider-source-types";

export interface ProviderSourceDirectoryGroup {
  key: string;
  label: string;
  description: string;
  items: ProviderSourceItem[];
  total: number;
}

const props = defineProps<{
  groups: ProviderSourceDirectoryGroup[];
  totalCount: number;
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  categoryText: (item: ProviderSourceItem["category"]) => string;
  statusText: (item: ProviderSourceItem) => string;
  policyText: (item: ProviderSourceItem) => string;
  modeText: (item: ProviderSourceItem["access_mode"]) => string;
  slaText: (item: ProviderSourceItem) => string;
  successText: (item: ProviderSourceItem) => string;
  effectiveAvailability: (item: ProviderSourceItem) => ProviderSourceItem["availability"];
  testing: string | null;
}>();

const emit = defineEmits<{
  pageChange: [page: number];
  test: [item: ProviderSourceItem];
  edit: [item: ProviderSourceItem];
  compatibility: [item: ProviderSourceItem];
  versions: [item: ProviderSourceItem];
  samples: [item: ProviderSourceItem];
}>();

const selectedCode = ref("");
const detailTrigger = ref<HTMLElement | null>(null);
async function openDetail(item: ProviderSourceItem, event: MouseEvent) {
  detailTrigger.value = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  selectedCode.value = item.code;
  await nextTick();
  document
    .querySelector<HTMLElement>(".source-center .source-record--selected .source-detail-back")
    ?.focus({
      preventScroll: true,
    });
}

async function closeDetail() {
  const trigger = detailTrigger.value;
  selectedCode.value = "";
  await nextTick();
  if (trigger?.isConnected) trigger.focus({ preventScroll: true });
}
</script>

<template>
  <section id="source-results" class="source-purpose-groups" aria-label="按业务用途分组的热点来源">
    <section
      v-for="group in props.groups"
      :key="group.key"
      class="source-purpose-group"
      :class="{
        'source-purpose-group--hidden':
          selectedCode && !group.items.some((item) => item.code === selectedCode),
      }"
    >
      <header class="source-purpose-head">
        <div>
          <p>业务用途</p>
          <h3>{{ group.label }}</h3>
        </div>
        <span
          >{{ group.description }} 本页 {{ group.items.length }} 个，筛选结果共
          {{ group.total }} 个</span
        >
      </header>
      <div class="source-list">
        <article
          v-for="item in group.items"
          :key="item.code"
          :data-availability="props.effectiveAvailability(item)"
          :class="{
            'source-record--selected': selectedCode === item.code,
            'source-record--hidden': selectedCode && selectedCode !== item.code,
          }"
        >
          <header>
            <div>
              <small
                >{{ props.categoryText(item.category) }} · {{ item.markets.join(" / ") }}</small
              >
              <h3>{{ item.name }}</h3>
            </div>
            <b>{{ props.statusText(item) }}</b>
          </header>
          <dl class="source-record-summary" aria-label="来源摘要">
            <div>
              <dt>采集方式</dt>
              <dd>{{ props.modeText(item.access_mode) }}</dd>
            </div>
            <div>
              <dt>最近成功</dt>
              <dd>{{ props.successText(item) }}</dd>
            </div>
          </dl>
          <button
            v-show="!selectedCode"
            type="button"
            class="source-detail-trigger"
            :aria-controls="`source-detail-${item.code}`"
            @click="openDetail(item, $event)"
          >
            查看来源详情
          </button>
          <div :id="`source-detail-${item.code}`" class="source-record-body">
            <button type="button" class="source-detail-back" @click="closeDetail">
              返回来源目录
            </button>
            <p>
              {{ props.policyText(item) }}
              <a
                v-if="item.target_url.startsWith('https://')"
                class="source-target"
                :href="item.target_url"
                target="_blank"
                rel="noopener noreferrer"
                >查看来源页面 ↗</a
              >
            </p>
            <dl class="source-record-facts">
              <div>
                <dt>采集方式</dt>
                <dd>{{ props.modeText(item.access_mode) }}</dd>
              </div>
              <div>
                <dt>频率</dt>
                <dd>{{ item.provisioned?.schedule_minutes ?? item.schedule_minutes }} 分钟</dd>
              </div>
              <div>
                <dt>超时 / 重试</dt>
                <dd>
                  {{ item.provisioned?.timeout_ms ?? item.timeout_ms }} ms /
                  {{ item.provisioned?.retry_limit ?? item.retry_limit }} 次
                </dd>
              </div>
              <div>
                <dt>负责人</dt>
                <dd>{{ item.owner_label }}</dd>
              </div>
              <div>
                <dt>更新 SLA</dt>
                <dd>{{ props.slaText(item) }}</dd>
              </div>
              <div>
                <dt>最近成功任务</dt>
                <dd>{{ props.successText(item) }}</dd>
              </div>
              <div>
                <dt>影响范围</dt>
                <dd>
                  {{ props.categoryText(item.category) }} · {{ item.markets.join(" / ") }} ·
                  {{ item.fields.length }} 类字段
                </dd>
              </div>
            </dl>
            <footer>
              <span>{{ item.languages.join(" / ") }} · {{ item.fields.length }} 类数据字段</span>
              <button
                v-if="
                  item.provisioned &&
                  item.availability === 'automatic' &&
                  ['public_page', 'public_rss'].includes(item.access_mode)
                "
                type="button"
                :disabled="Boolean(props.testing)"
                @click="emit('test', item)"
              >
                {{ props.testing === item.provisioned.id ? "测试中…" : "匿名测试" }}
              </button>
              <button v-if="item.provisioned" type="button" @click="emit('edit', item)">
                编辑采集设置
              </button>
              <button
                v-if="
                  item.provisioned &&
                  ['public_page', 'authenticated_browser'].includes(item.access_mode)
                "
                type="button"
                @click="emit('compatibility', item)"
              >
                解析兼容矩阵
              </button>
              <button v-if="item.provisioned" type="button" @click="emit('versions', item)">
                版本与回滚
              </button>
              <RouterLink
                v-if="item.access_mode === 'authenticated_browser'"
                :to="`/platform-admin/credentials?provider_code=${encodeURIComponent(item.code)}&mode=login`"
                >配置网页登录</RouterLink
              >
              <button
                v-if="item.code === '1688_search' && item.provisioned"
                type="button"
                @click="emit('samples', item)"
              >
                固定样本回放
              </button>
              <RouterLink
                v-if="item.code === '1688_search'"
                to="/platform-admin/providers/sources/1688-acceptance"
                >登录准备状态</RouterLink
              >
              <span v-if="!item.provisioned && item.access_mode !== 'authenticated_browser'"
                >等待系统登记</span
              >
            </footer>
          </div>
        </article>
      </div>
    </section>
    <p v-if="!props.groups.length" class="source-empty-results">没有符合筛选条件的来源。</p>
    <nav v-if="props.totalCount" class="source-pagination" aria-label="热点来源分页">
      <button
        type="button"
        :disabled="props.page === 1"
        @click="emit('pageChange', props.page - 1)"
      >
        上一页
      </button>
      <span
        >第 {{ props.page }} / {{ props.totalPages }} 页 · 当前 {{ props.rangeStart }}–{{
          props.rangeEnd
        }}，共 {{ props.totalCount }} 个来源</span
      >
      <button
        type="button"
        :disabled="props.page === props.totalPages"
        @click="emit('pageChange', props.page + 1)"
      >
        下一页
      </button>
    </nav>
  </section>
</template>

<style scoped src="./ProviderSourceDirectory.css"></style>
