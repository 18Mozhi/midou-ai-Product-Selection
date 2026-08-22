<script setup lang="ts">
import type { ProviderPageCompatibilityObservation } from "./provider-source-types";

defineProps<{
  sourceName: string;
  adapterVersion: string | null;
  loading: boolean;
  error: string;
  rows: ProviderPageCompatibilityObservation[];
}>();

defineEmits<{ close: [] }>();

const statusText = (value: ProviderPageCompatibilityObservation["status"]) =>
  ({
    compatible: "已兼容",
    incompatible: "解析不兼容",
    mixed: "结果不一致",
    unverified: "待验证",
  })[value];
const fingerprint = (value: string) => `sha256:${value.slice(0, 12)}`;
const time = (value: string) => new Date(value).toLocaleString("zh-CN", { hour12: false });
</script>

<template>
  <div class="source-modal" role="dialog" aria-modal="true" aria-labelledby="compatibility-title">
    <section class="compatibility-panel">
      <header>
        <div>
          <p>真实页面观测</p>
          <h3 id="compatibility-title">解析器与页面版本 · {{ sourceName }}</h3>
          <span>页面版本来自仍在保留期内的 DOM 或 HTML 证据 SHA-256，不读取或展示页面内容。</span>
        </div>
        <button type="button" aria-label="关闭解析兼容矩阵" @click="$emit('close')">×</button>
      </header>
      <p v-if="adapterVersion" class="compatibility-adapter">
        当前采集程序版本：<strong>{{ adapterVersion }}</strong>
      </p>
      <div v-if="loading" class="source-state">正在汇总真实页面版本…</div>
      <div v-else-if="error" class="source-state" data-kind="error">{{ error }}</div>
      <div v-else-if="rows.length" class="compatibility-matrix">
        <article v-for="row in rows" :key="`${row.parser_version}:${row.page_version_sha256}`">
          <header>
            <div>
              <small>页面版本（DOM SHA-256）</small>
              <strong>{{ fingerprint(row.page_version_sha256) }}</strong>
            </div>
            <i :data-status="row.status">{{ statusText(row.status) }}</i>
          </header>
          <dl>
            <div>
              <dt>解析器版本</dt>
              <dd>{{ row.parser_version }}</dd>
            </div>
            <div>
              <dt>观测次数</dt>
              <dd>{{ row.observation_count }}</dd>
            </div>
            <div>
              <dt>成功 / 解析失败</dt>
              <dd>{{ row.succeeded_count }} / {{ row.parser_failure_count }}</dd>
            </div>
            <div>
              <dt>最近观测</dt>
              <dd>{{ time(row.last_observed_at) }}</dd>
            </div>
          </dl>
          <details>
            <summary>技术详情</summary>
            <code>{{ row.page_version_sha256 }}</code>
          </details>
        </article>
      </div>
      <section v-else class="source-state">
        <strong>尚无可比较的真实页面版本</strong>
        <p>先运行真实页面采集；系统只使用已留存的 DOM/HTML 证据生成矩阵。</p>
      </section>
    </section>
  </div>
</template>

<style scoped>
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
  font-size: 11px;
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
</style>
