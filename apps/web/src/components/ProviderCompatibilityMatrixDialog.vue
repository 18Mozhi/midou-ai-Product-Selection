<script setup lang="ts">
import { computed, ref } from "vue";
import type { ProviderPageCompatibilityObservation } from "./provider-source-types";
import { useProviderSourceDialogFocus } from "./useProviderSourceDialogFocus";

const props = defineProps<{
  sourceName: string;
  adapterVersion: string | null;
  loading: boolean;
  error: string;
  requestId: string;
  rows: ProviderPageCompatibilityObservation[];
}>();

const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLElement | null>(null);
const title = ref<HTMLElement | null>(null);
const dialogFocus = useProviderSourceDialogFocus(
  () => true,
  dialog,
  title,
  () => emit("close"),
);

const statusText = (value: ProviderPageCompatibilityObservation["status"]) =>
  ({
    compatible: "已兼容",
    incompatible: "解析不兼容",
    mixed: "结果不一致",
    unverified: "待验证",
  })[value];
const fingerprint = (value: string) => `sha256:${value.slice(0, 12)}`;
const time = (value: string) => new Date(value).toLocaleString("zh-CN", { hour12: false });
const statusCounts = computed(() => ({
  incompatible: props.rows.filter((row) => row.status === "incompatible").length,
  mixed: props.rows.filter((row) => row.status === "mixed").length,
  unverified: props.rows.filter((row) => row.status === "unverified").length,
  compatible: props.rows.filter((row) => row.status === "compatible").length,
}));
const highestRisk = computed(() =>
  statusCounts.value.incompatible
    ? "存在解析不兼容观测"
    : statusCounts.value.mixed
      ? "存在结果不一致观测"
      : statusCounts.value.unverified
        ? "仍有页面版本待验证"
        : "当前观测均兼容",
);
</script>

<template>
  <div
    ref="dialog"
    class="source-modal p48-compatibility-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="compatibility-title"
    @keydown="dialogFocus.onKeydown"
  >
    <section class="compatibility-panel p48-compatibility-panel" :aria-busy="loading">
      <header class="p48-compatibility-identity">
        <div>
          <p>来源采集 / 页面版本观测</p>
          <h3 id="compatibility-title" ref="title" tabindex="-1">
            解析器与页面版本 · {{ sourceName }}
          </h3>
          <p>
            页面版本来自留存期内的 DOM 或 HTML 证据
            SHA-256；矩阵不展示页面内容，也不会自动改变来源状态。
          </p>
        </div>
        <button type="button" aria-label="关闭解析兼容矩阵" @click="emit('close')">×</button>
      </header>
      <div class="p48-compatibility-body">
        <p v-if="adapterVersion" class="compatibility-adapter">
          当前采集程序版本：<strong>{{ adapterVersion }}</strong>
        </p>
        <p v-else class="compatibility-adapter" data-kind="missing">当前采集程序版本未提供。</p>
        <div v-if="loading" class="source-state" aria-live="polite">正在汇总真实页面版本…</div>
        <div v-else-if="error" class="source-state" data-kind="error" role="status">
          <strong>兼容观测暂时无法读取</strong>
          <p>{{ error }}</p>
          <details v-if="requestId">
            <summary>技术详情</summary>
            <code>{{ requestId }}</code>
          </details>
        </div>
        <template v-else-if="rows.length">
          <section class="p48-compatibility-summary" aria-label="观测结论汇总">
            <div>
              <p>最高风险结论</p>
              <h4>{{ highestRisk }}</h4>
            </div>
            <dl>
              <div>
                <dt>解析不兼容</dt>
                <dd>{{ statusCounts.incompatible }}</dd>
              </div>
              <div>
                <dt>结果不一致</dt>
                <dd>{{ statusCounts.mixed }}</dd>
              </div>
              <div>
                <dt>待验证</dt>
                <dd>{{ statusCounts.unverified }}</dd>
              </div>
              <div>
                <dt>均兼容</dt>
                <dd>{{ statusCounts.compatible }}</dd>
              </div>
            </dl>
          </section>
          <section
            class="p48-compatibility-ledger"
            aria-labelledby="compatibility-observations-title"
          >
            <header>
              <div>
                <p>真实页面历史观测</p>
                <h4 id="compatibility-observations-title">页面版本明细</h4>
              </div>
              <span>{{ rows.length }} 项观测组合</span>
            </header>
            <div
              class="p48-compatibility-table-wrap"
              role="region"
              aria-label="页面版本兼容观测明细"
              tabindex="0"
            >
              <table>
                <thead>
                  <tr>
                    <th>页面指纹</th>
                    <th>状态</th>
                    <th>解析器版本</th>
                    <th>观测次数</th>
                    <th>成功 / 失败</th>
                    <th>最近观测</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in rows" :key="`${row.parser_version}:${row.page_version_sha256}`">
                    <td>
                      <span class="compatibility-cell-label">页面指纹</span
                      ><strong>{{ fingerprint(row.page_version_sha256) }}</strong>
                      <details>
                        <summary>完整指纹</summary>
                        <code>{{ row.page_version_sha256 }}</code>
                      </details>
                    </td>
                    <td>
                      <span class="compatibility-cell-label">状态</span
                      ><i :data-status="row.status">{{ statusText(row.status) }}</i>
                    </td>
                    <td>
                      <span class="compatibility-cell-label">解析器版本</span
                      ><span>{{ row.parser_version }}</span>
                    </td>
                    <td>
                      <span class="compatibility-cell-label">观测次数</span
                      ><span>{{ row.observation_count }}</span>
                    </td>
                    <td>
                      <span class="compatibility-cell-label">成功 / 失败</span
                      ><span>{{ row.succeeded_count }} / {{ row.parser_failure_count }}</span>
                    </td>
                    <td>
                      <span class="compatibility-cell-label">最近观测</span
                      ><span>{{ time(row.last_observed_at) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
        <section v-else class="source-state">
          <strong>尚无可比较的真实页面版本</strong>
          <p>先运行真实页面采集；系统只使用已留存的 DOM/HTML 证据生成矩阵。</p>
        </section>
      </div>
      <footer class="p48-compatibility-actions">
        <p>历史观测只说明留存证据中的解析结果，不代表当前页面实时状态。</p>
        <button type="button" @click="emit('close')">关闭</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
@import "../design/provider-compatibility-tokens.css";

.source-modal {
  position: fixed;
  z-index: 80;
  inset: 0;
  padding: 20px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--so-bg) 80%, transparent);
}
.compatibility-panel {
  width: min(900px, 100%);
  max-height: min(780px, 90vh);
  overflow: auto;
  display: grid;
  gap: 16px;
  padding: 24px;
  border: 1px solid var(--so-border);
  border-radius: 18px;
  background: var(--so-bg-elevated);
  color: var(--so-text);
}
.compatibility-panel > header,
.compatibility-matrix article > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}
.compatibility-panel > header > div,
.compatibility-matrix article header > div {
  display: grid;
  gap: 4px;
}
.compatibility-panel h3,
.compatibility-panel p,
.compatibility-panel dl,
.compatibility-panel dd {
  margin: 0;
}
.compatibility-panel header span,
.compatibility-matrix small,
.compatibility-matrix dt,
.compatibility-panel .source-state p {
  color: var(--so-text-muted);
}
.compatibility-panel > header > button {
  flex: none;
  border: 0;
  background: transparent;
  color: var(--so-text);
  font-size: 22px;
}
.compatibility-adapter {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--so-panel-soft);
}
.compatibility-matrix {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.compatibility-matrix article {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--so-border);
  border-radius: 12px;
  background: var(--so-panel);
}
.compatibility-matrix i {
  flex: none;
  border-radius: 999px;
  padding: 4px 8px;
  background: var(--so-panel-soft);
  color: var(--so-text-muted);
  font-style: normal;
  font-size: 13px;
}
.compatibility-matrix i[data-status="compatible"] {
  background: var(--so-success-soft);
  color: var(--so-success);
}
.compatibility-matrix i[data-status="mixed"],
.compatibility-matrix i[data-status="incompatible"] {
  background: var(--so-warning-soft);
  color: var(--so-warning);
}
.compatibility-matrix dl {
  display: grid;
  gap: 7px;
  margin: 12px 0;
}
.compatibility-matrix dl > div {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 8px;
}
.compatibility-matrix code {
  overflow-wrap: anywhere;
}
.source-state {
  padding: 30px;
  text-align: center;
}
@media (max-width: 760px) {
  .compatibility-matrix {
    grid-template-columns: 1fr;
  }
  .compatibility-matrix dl > div {
    grid-template-columns: 1fr;
  }
}
.source-modal.p48-compatibility-modal {
  padding: 24px;
  background: var(--p48-scrim);
  backdrop-filter: blur(8px);
}
.p48-compatibility-panel {
  width: min(1080px, 100%);
  max-height: calc(100dvh - 48px);
  gap: 0;
  padding: 0;
  overflow: auto;
  border: 1px solid var(--p48-panel-border);
  border-radius: 20px;
  background: var(--p48-panel);
  box-shadow: 0 28px 72px var(--p48-shadow);
}
.p48-compatibility-identity {
  align-items: flex-start;
  padding: 26px 30px;
  color: var(--p48-on-accent);
  background: var(--p48-accent);
}
.p48-compatibility-identity > div {
  display: grid;
  gap: 8px;
}
.p48-compatibility-identity h3 {
  color: var(--p48-on-accent);
  font-size: clamp(24px, 3vw, 32px);
  line-height: 1.2;
  outline: none;
}
.p48-compatibility-identity p {
  color: var(--p48-on-accent-muted);
  font-size: 13px;
  line-height: 1.55;
}
.p48-compatibility-identity > button {
  flex: 0 0 44px;
  width: 44px;
  min-height: 44px;
  border: 1px solid var(--p48-on-accent-border);
  border-radius: 10px;
  color: var(--p48-on-accent);
  background: var(--p48-on-accent-soft);
}
.p48-compatibility-body {
  display: grid;
  gap: 18px;
  padding: 22px 30px 26px;
  background: var(--p48-panel);
}
.p48-compatibility-body .compatibility-adapter {
  padding: 12px 14px;
  border-left: 4px solid var(--p48-adapter-accent);
  color: var(--p48-adapter-ink);
  background: var(--p48-adapter-panel);
}
.p48-compatibility-body .compatibility-adapter[data-kind="missing"] {
  border-left-color: var(--p48-missing-border);
  background: var(--p48-missing-panel);
}
.p48-compatibility-summary {
  display: grid;
  grid-template-columns: minmax(230px, 0.8fr) minmax(0, 1.6fr);
  gap: 20px;
  align-items: center;
  padding: 18px 20px;
  border: 1px solid var(--p48-summary-border);
  background: var(--p48-on-accent);
}
.p48-compatibility-summary > div > p,
.p48-compatibility-summary h4,
.p48-compatibility-summary dl,
.p48-compatibility-summary dt,
.p48-compatibility-summary dd {
  margin: 0;
}
.p48-compatibility-summary > div > p,
.p48-compatibility-ledger > header p {
  color: var(--p48-accent);
  font-size: 13px;
  font-weight: 750;
  letter-spacing: 0.06em;
}
.p48-compatibility-summary h4 {
  margin-top: 5px;
  color: var(--p48-ink);
  font-size: 20px;
}
.p48-compatibility-summary dl {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border: 1px solid var(--p48-divider);
  background: var(--p48-divider);
  gap: 1px;
}
.p48-compatibility-summary dl > div {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px 12px;
  background: var(--p48-summary-cell);
}
.p48-compatibility-summary dt {
  color: var(--p48-muted);
  font-size: 13px;
}
.p48-compatibility-summary dd {
  color: var(--p48-ink);
  font-size: 19px;
  font-weight: 750;
}
.p48-compatibility-ledger {
  display: grid;
  gap: 12px;
}
.p48-compatibility-ledger > header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 14px;
}
.p48-compatibility-ledger > header p,
.p48-compatibility-ledger > header h4 {
  margin: 0;
}
.p48-compatibility-ledger > header h4 {
  margin-top: 4px;
  color: var(--p48-ink);
  font-size: 19px;
}
.p48-compatibility-ledger > header > span {
  color: var(--p48-subtle);
  font-size: 13px;
}
.p48-compatibility-table-wrap {
  min-width: 0;
  overflow-x: auto;
  background: var(--p48-on-accent);
}
.p48-compatibility-table-wrap table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  color: var(--p48-table-ink);
  background: var(--p48-on-accent);
}
.p48-compatibility-table-wrap th,
.p48-compatibility-table-wrap td {
  padding: 11px 10px;
  overflow-wrap: anywhere;
  border: 1px solid var(--p48-divider);
  text-align: left;
  vertical-align: top;
}
.p48-compatibility-table-wrap th {
  color: var(--p48-table-muted);
  background: var(--p48-table-header);
  font-size: 13px;
}
.p48-compatibility-table-wrap th:nth-child(1) {
  width: 19%;
}
.p48-compatibility-table-wrap th:nth-child(2) {
  width: 12%;
}
.p48-compatibility-table-wrap th:nth-child(3) {
  width: 21%;
}
.p48-compatibility-table-wrap th:nth-child(4) {
  width: 11%;
}
.p48-compatibility-table-wrap th:nth-child(5) {
  width: 15%;
}
.p48-compatibility-table-wrap th:nth-child(6) {
  width: 22%;
}
.p48-compatibility-table-wrap td > strong {
  display: block;
  color: var(--p48-ink);
  font-family: ui-monospace, "Cascadia Code", monospace;
}
.p48-compatibility-table-wrap .compatibility-cell-label {
  display: none;
}
.p48-compatibility-table-wrap td > details {
  margin-top: 4px;
  font-size: 13px;
}
.p48-compatibility-table-wrap td > details summary {
  min-height: 44px;
  line-height: 44px;
}
.p48-compatibility-table-wrap td > details code {
  display: block;
  overflow-wrap: anywhere;
  color: var(--p48-code-ink);
}
.p48-compatibility-table-wrap i {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  padding: 4px 9px;
  border-radius: 999px;
  color: var(--p48-badge-ink);
  background: var(--p48-badge-panel);
  font-size: 13px;
  font-style: normal;
  font-weight: 700;
}
.p48-compatibility-table-wrap i[data-status="compatible"] {
  color: var(--p48-success);
  background: var(--p48-success-panel);
}
.p48-compatibility-table-wrap i[data-status="incompatible"],
.p48-compatibility-table-wrap i[data-status="mixed"] {
  color: var(--p48-warning);
  background: var(--p48-warning-panel);
}
.p48-compatibility-panel :focus-visible {
  outline: 3px solid var(--p48-adapter-accent);
  outline-offset: 3px;
}
.p48-compatibility-actions {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 30px;
  border-top: 1px solid var(--p48-divider);
  background: var(--p48-sticky-panel);
  backdrop-filter: blur(10px);
}
.p48-compatibility-actions p {
  margin: 0;
  color: var(--p48-muted);
  font-size: 13px;
  line-height: 1.5;
}
.p48-compatibility-actions button {
  min-width: 90px;
  min-height: 44px;
  color: var(--p48-table-ink);
  background: var(--p48-on-accent);
}
@media (max-width: 760px) {
  .source-modal.p48-compatibility-modal {
    display: block;
    padding: 0;
  }
  .p48-compatibility-panel {
    width: 100%;
    min-height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
  }
  .p48-compatibility-identity {
    padding: 24px 20px;
  }
  .p48-compatibility-identity h3 {
    font-size: 25px;
  }
  .p48-compatibility-body {
    gap: 16px;
    padding: 18px 20px 22px;
  }
  .p48-compatibility-summary {
    grid-template-columns: 1fr;
    gap: 14px;
    padding: 16px;
  }
  .p48-compatibility-summary dl {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .p48-compatibility-ledger > header {
    align-items: flex-start;
  }
  .p48-compatibility-table-wrap {
    overflow: visible;
  }
  .p48-compatibility-table-wrap table,
  .p48-compatibility-table-wrap tbody,
  .p48-compatibility-table-wrap tr,
  .p48-compatibility-table-wrap td {
    display: block;
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }
  .p48-compatibility-table-wrap thead {
    display: none;
  }
  .p48-compatibility-table-wrap tbody {
    display: grid;
    gap: 12px;
  }
  .p48-compatibility-table-wrap tr {
    border: 1px solid var(--p48-summary-border);
    background: var(--p48-on-accent);
  }
  .p48-compatibility-table-wrap td {
    display: grid;
    grid-template-columns: 100px minmax(0, 1fr);
    gap: 10px;
    align-items: start;
    padding: 10px 12px;
    border: 0;
    border-bottom: 1px solid var(--p48-mobile-divider);
  }
  .p48-compatibility-table-wrap td:last-child {
    border-bottom: 0;
  }
  .p48-compatibility-table-wrap td > .compatibility-cell-label {
    display: block;
    color: var(--p48-muted);
    font-size: 13px;
    font-weight: 700;
  }
  .p48-compatibility-table-wrap td > details {
    grid-column: 2;
  }
  .p48-compatibility-actions {
    display: grid;
    gap: 8px;
    padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
  }
  .p48-compatibility-actions button {
    width: 100%;
  }
}
@media (forced-colors: active) {
  .p48-compatibility-panel,
  .p48-compatibility-identity,
  .p48-compatibility-summary,
  .p48-compatibility-table-wrap table {
    border: 1px solid CanvasText;
  }
}
</style>
