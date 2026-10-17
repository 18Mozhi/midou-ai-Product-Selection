<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from "vue";
import { createApiClient } from "../api-client";
import type { SourcingSearch } from "./sourcing-workspace-types";
import { formatOpportunityTime } from "./opportunity-workspace-presentation";

const props = defineProps<{
  apiBaseUrl: string;
  opportunityId: string;
  searches: SourcingSearch[];
  listState: "loading" | "ready" | "error";
  canRead: boolean;
}>();
const emit = defineEmits<{ retryList: [] }>();
const related = computed(() =>
  props.searches.filter(
    (item) => item.input_type === "opportunity" && item.input_ref === props.opportunityId,
  ),
);
const selectedId = ref("");
const selected = ref<SourcingSearch | null>(null);
const state = ref<"loading" | "ready" | "error">("loading");
let controller: AbortController | null = null;
let generation = 0;
function invalidate() {
  generation += 1;
  controller?.abort();
  controller = null;
  selected.value = null;
}
async function load() {
  invalidate();
  if (
    !props.canRead ||
    props.listState !== "ready" ||
    !related.value.some((item) => item.id === selectedId.value)
  )
    return;
  const id = selectedId.value,
    opportunityId = props.opportunityId,
    current = generation;
  const readController = new AbortController();
  controller = readController;
  state.value = "loading";
  try {
    const response = await createApiClient(props.apiBaseUrl)<SourcingSearch>(
      `/sourcing/searches/${encodeURIComponent(id)}`,
      { signal: readController.signal },
    );
    if (readController.signal.aborted || current !== generation) return;
    if (
      response.data.id !== id ||
      response.data.input_type !== "opportunity" ||
      response.data.input_ref !== opportunityId
    )
      throw new Error("sourcing_detail_identity_mismatch");
    selected.value = response.data;
    state.value = "ready";
  } catch {
    if (readController.signal.aborted || current !== generation) return;
    state.value = "error";
  }
}
watch(
  () => [props.opportunityId, props.searches, props.canRead, props.listState],
  () => {
    invalidate();
    selectedId.value = related.value.some((item) => item.id === selectedId.value)
      ? selectedId.value
      : (related.value[0]?.id ?? "");
    void load();
  },
  { immediate: true },
);
onBeforeUnmount(invalidate);
let wasDeactivated = false;
onDeactivated(() => {
  wasDeactivated = true;
  invalidate();
});
onActivated(() => {
  if (wasDeactivated) {
    wasDeactivated = false;
    void load();
  }
});
const candidates = computed(() => selected.value?.candidates ?? []);
function sourceLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
function is1688(value: string) {
  const link = sourceLink(value);
  return link != null && new URL(link).hostname === "detail.1688.com";
}
</script>

<template>
  <section class="selection-supply" aria-label="当前商品货源报价">
    <header>
      <div>
        <h4>货源报价</h4>
        <p>先核对规格与报价，再判断采购成本。候选关联不等于同款确认。</p>
      </div>
      <label v-if="canRead && listState === 'ready' && related.length"
        >找货记录
        <select v-model="selectedId" @change="load">
          <option v-for="(item, index) in related" :key="item.id" :value="item.id">
            记录 {{ index + 1 }} · {{ formatOpportunityTime(item.created_at) }} ·
            {{ item.candidate_count }} 个候选
          </option>
        </select>
      </label>
    </header>
    <p v-if="!canRead" role="status">暂无供应链查看权限。</p>
    <p v-else-if="listState === 'loading'" role="status">正在读取关联找货记录…</p>
    <div v-else-if="listState === 'error'" role="alert">
      <p>关联找货记录暂不可用，利润数据仍可查看。</p>
      <button type="button" @click="emit('retryList')">重试读取找货记录</button>
    </div>
    <p v-else-if="!related.length">暂无当前商品的找货记录。</p>
    <p v-else-if="state === 'loading'" role="status">正在读取货源报价…</p>
    <div v-else-if="state === 'error'" role="alert">
      <p>货源报价暂不可用，利润数据仍可查看。</p>
      <button type="button" @click="load">重试读取货源报价</button>
    </div>
    <template v-else>
      <p v-if="!candidates.length">当前找货记录暂无候选报价。</p>
      <div v-else class="selection-supply-scroll" tabindex="0" aria-label="货源报价明细">
        <table>
          <caption>
            当前找货记录的供应商、规格、报价和证据
          </caption>
          <thead>
            <tr>
              <th scope="col">供应商 / 商品</th>
              <th scope="col">规格</th>
              <th scope="col">报价</th>
              <th scope="col">起订量</th>
              <th scope="col">交期 / 地点</th>
              <th scope="col">来源与证据</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in candidates" :key="item.id">
              <th scope="row">
                <strong>{{ item.supplier_name }}</strong
                ><span>{{ item.product_title }}</span
                ><small>{{ is1688(item.original_url) ? "1688" : "公开货源" }}</small>
              </th>
              <td data-label="规格">{{ item.specification || "规格未提供" }}</td>
              <td data-label="报价">
                <strong>{{ item.currency }} {{ item.quoted_price }}</strong
                ><small>{{ item.quote ? `已保存报价 v${item.quote.version}` : "采集报价" }}</small
                ><span v-if="item.source_price_description"
                  >原始报价：{{ item.source_price_description }}</span
                >
              </td>
              <td data-label="起订量">{{ item.moq ?? "未提供" }}</td>
              <td data-label="交期 / 地点">
                {{ item.lead_time_days == null ? "交期未提供" : `${item.lead_time_days} 天`
                }}<small>{{ item.location || "地点未提供" }}</small>
              </td>
              <td data-label="来源与证据">
                <a
                  v-if="sourceLink(item.original_url)"
                  :href="sourceLink(item.original_url)!"
                  target="_blank"
                  rel="noopener noreferrer"
                  >查看原始货源 ↗</a
                ><span v-else>原始链接不可用</span
                ><small>采集 {{ formatOpportunityTime(item.observed_at) }}</small>
                <details>
                  <summary>报价依据</summary>
                  <span>采集证据 {{ item.evidence_id }}</span
                  ><span v-if="item.quote"
                    >报价证据 {{ item.quote.evidence_id }} ·
                    {{ formatOpportunityTime(item.quote.observed_at) }}</span
                  ><span v-if="item.missing_fields.length"
                    >缺失：{{ item.missing_fields.join("、") }}</span
                  >
                </details>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>报价保留原币种与采集时间；未统一规格、计量单位或币种前，不按金额排序或换算为进货价。</p>
    </template>
  </section>
</template>

<style scoped>
.selection-supply {
  margin-bottom: 20px;
  padding: 20px;
  border: 1px solid var(--so-border);
  background: var(--so-panel);
  color: var(--so-text);
  min-width: 0;
  font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
  font-weight: 400;
}
.selection-supply > header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
}
.selection-supply h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.selection-supply p {
  margin: 8px 0 12px;
  color: var(--so-text-muted);
  font-size: 13px;
  line-height: 1.6;
  font-weight: 400;
}
.selection-supply label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  min-width: 180px;
}
.selection-supply :is(select, button) {
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--so-border);
  border-radius: 4px;
  background: var(--so-panel);
  color: var(--so-text);
  font: inherit;
  font-size: 13px;
}
.selection-supply-scroll {
  overflow-x: auto;
}
.selection-supply table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}
.selection-supply caption {
  text-align: left;
  padding: 10px 0;
  color: var(--so-text-muted);
}
.selection-supply :is(th, td) {
  vertical-align: top;
  padding: 12px;
  border-bottom: 1px solid var(--so-border);
  overflow-wrap: anywhere;
}
.selection-supply thead th {
  background: var(--so-panel);
  white-space: nowrap;
}
.selection-supply tbody th {
  max-width: 240px;
  min-width: 180px;
  font-weight: 400;
}
.selection-supply :is(td, th) :is(strong, span, small) {
  display: block;
  margin-bottom: 6px;
}
.selection-supply small {
  font-size: 13px;
  color: var(--so-text-muted);
}
.selection-supply a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--so-primary);
}
.selection-supply summary {
  min-height: 44px;
  display: flex;
  align-items: center;
  cursor: pointer;
}
.selection-supply :is(a, select, button, summary, .selection-supply-scroll):focus-visible {
  outline: 2px solid var(--so-primary);
  outline-offset: 2px;
}
@media (max-width: 760px) {
  .selection-supply {
    padding: 12px;
  }
  .selection-supply > header {
    display: block;
  }
  .selection-supply label {
    min-width: 0;
    margin-bottom: 12px;
  }
  .selection-supply-scroll {
    overflow: visible;
  }
  .selection-supply table {
    min-width: 0;
    display: block;
  }
  .selection-supply caption {
    display: block;
  }
  .selection-supply thead {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .selection-supply tbody {
    display: grid;
    gap: 12px;
  }
  .selection-supply tbody tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    border-top: 1px solid var(--so-border);
  }
  .selection-supply :is(th, td) {
    min-width: 0;
    max-width: none;
    padding: 12px 0;
  }
  .selection-supply tbody th,
  .selection-supply td:last-child {
    grid-column: 1 / -1;
  }
  .selection-supply td:nth-child(even) {
    padding-right: 10px;
  }
  .selection-supply td[data-label]::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 6px;
    color: var(--so-text-muted);
    font-size: 13px;
  }
}
</style>
