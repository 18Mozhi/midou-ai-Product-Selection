<script setup lang="ts">
import type {
  ConfigurationChange,
  ConfigurationVersion,
  ProviderSourceConfigurationForm,
  ProviderSourceConfigurationPreview,
  ProviderSourceItem,
} from "./provider-source-types";

const props = defineProps<{
  editing: ProviderSourceItem | null;
  form: ProviderSourceConfigurationForm;
  preview: ProviderSourceConfigurationPreview | null;
  saving: boolean;
  versionSource: ProviderSourceItem | null;
  versionLoading: boolean;
  versionHistory: ConfigurationVersion[];
  rollingBack: number | null;
  rollbackReason: string;
}>();

const emit = defineEmits<{
  closeEdit: [];
  save: [];
  closeVersions: [];
  rollback: [version: ConfigurationVersion];
  "update:form": [form: ProviderSourceConfigurationForm];
  "update:rollbackReason": [value: string];
}>();

const updateForm = (field: keyof ProviderSourceConfigurationForm, value: string | number) =>
  emit("update:form", { ...props.form, [field]: value });
const displayValue = (value: unknown) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text == null ? "未提供" : text.length > 240 ? `${text.slice(0, 240)}…` : text;
};
const configurationFieldText = (field: ConfigurationChange["field"]) =>
  ({
    schedule_minutes: "采集频率",
    timeout_ms: "单次超时",
    retry_limit: "失败重试",
    status: "运行状态",
  })[field];
const configurationActionText = (action: string) =>
  ({
    created: "创建配置",
    updated: "更新配置",
    configuration_updated: "更新采集设置",
    configuration_rolled_back: "从历史版本恢复",
  })[action] ?? "配置变更";
const requiresSmokeTest = (source: ProviderSourceItem, form: ProviderSourceConfigurationForm) =>
  source.provisioned?.status !== "enabled" &&
  form.status === "enabled" &&
  ["public_page", "public_rss"].includes(source.access_mode);
</script>

<template>
  <div
    v-if="editing"
    class="source-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="source-edit-title"
  >
    <form @submit.prevent="$emit('save')">
      <header>
        <div>
          <p>编辑采集来源</p>
          <h3 id="source-edit-title">{{ editing.name }}</h3>
        </div>
        <button type="button" aria-label="关闭来源编辑" @click="$emit('closeEdit')">×</button>
      </header>
      <label
        >采集频率（分钟）<input
          :value="form.schedule_minutes"
          type="number"
          min="1"
          max="10080"
          required
          @input="
            updateForm('schedule_minutes', Number(($event.target as HTMLInputElement).value))
          "
      /></label>
      <label
        >单次超时（毫秒）<input
          :value="form.timeout_ms"
          type="number"
          min="1000"
          max="120000"
          required
          @input="updateForm('timeout_ms', Number(($event.target as HTMLInputElement).value))"
      /></label>
      <label
        >失败重试次数<input
          :value="form.retry_limit"
          type="number"
          min="0"
          max="10"
          required
          @input="updateForm('retry_limit', Number(($event.target as HTMLInputElement).value))"
      /></label>
      <label>
        {{ editing.availability === "automatic" ? "运行状态" : "来源设置状态" }}
        <select
          :value="form.status"
          @change="updateForm('status', ($event.target as HTMLSelectElement).value)"
        >
          <option value="enabled">启用</option>
          <option value="disabled">停用</option>
        </select>
      </label>
      <p v-if="requiresSmokeTest(editing, form)" class="source-smoke-notice">
        启用时会先以停用状态保存这版配置，再访问真实来源页面并验证解析结果；烟测失败不会启用来源。
      </p>
      <section v-if="preview" class="source-schedule-preview">
        <header>
          <div>
            <p>保存前运行预估</p>
            <h4>调度同频与当前并发占用</h4>
          </div>
        </header>
        <dl>
          <div>
            <dt>同频来源</dt>
            <dd>
              {{ preview.same_interval_enabled_count }} 个已启用来源配置为
              {{ form.schedule_minutes }} 分钟
            </dd>
          </div>
          <div>
            <dt>当前并发占用</dt>
            <dd>
              {{ preview.active_count }} / {{ preview.configured_limit }}， 剩余
              {{ preview.available_count }} 个配置槽位
            </dd>
          </div>
        </dl>
        <p>
          同频数量只提示可能进入同一调度窗口；系统未保存每个来源的独立相位，因此不把同频直接判定为必然冲突。并发占用来自当前待执行或执行中的真实子查询快照，不预测未来任务量。
        </p>
      </section>
      <label
        >变更原因<textarea
          :value="form.reason"
          minlength="2"
          maxlength="500"
          required
          @input="updateForm('reason', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>
      <footer>
        <button type="button" @click="$emit('closeEdit')">取消</button>
        <button :disabled="saving">
          {{ saving ? "处理中…" : requiresSmokeTest(editing, form) ? "烟测并启用" : "保存配置" }}
        </button>
      </footer>
    </form>
  </div>
  <div
    v-if="versionSource"
    class="source-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="configuration-version-title"
  >
    <section class="configuration-version-panel">
      <header>
        <div>
          <p>配置版本</p>
          <h3 id="configuration-version-title">版本、差异与回滚 · {{ versionSource.name }}</h3>
        </div>
        <button type="button" aria-label="关闭配置版本" @click="$emit('closeVersions')">×</button>
      </header>
      <p>只展示采集频率、超时、重试和启停状态；凭证、Cookie 与受限环境值不会进入版本详情。</p>
      <label
        >回滚原因<textarea
          :value="rollbackReason"
          minlength="2"
          maxlength="500"
          required
          @input="$emit('update:rollbackReason', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>
      <div v-if="versionLoading" class="source-state">正在读取配置版本…</div>
      <ol v-else class="configuration-version-list">
        <li v-for="version in versionHistory" :key="version.version">
          <header>
            <div>
              <strong>第 {{ version.version }} 版</strong
              ><span
                >{{ configurationActionText(version.action) }} ·
                {{ new Date(version.created_at).toLocaleString("zh-CN") }}</span
              >
            </div>
            <b v-if="version.current">当前版本</b>
            <button
              v-else-if="version.rollback_available"
              type="button"
              :disabled="rollingBack === version.version || rollbackReason.trim().length < 2"
              @click="$emit('rollback', version)"
            >
              {{ rollingBack === version.version ? "恢复中…" : "恢复此版本" }}
            </button>
          </header>
          <ul v-if="version.changes.length">
            <li v-for="change in version.changes" :key="change.field">
              <span>{{ configurationFieldText(change.field) }}</span
              ><code>{{ displayValue(change.before) }} → {{ displayValue(change.after) }}</code>
            </li>
          </ul>
          <p v-else>与上一版本的可见采集设置一致。</p>
        </li>
      </ol>
      <p v-if="!versionLoading && !versionHistory.length">还没有可用配置版本。</p>
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
.source-modal form,
.configuration-version-panel {
  width: min(520px, 100%);
  max-height: calc(100dvh - 40px);
  overflow-y: auto;
  display: grid;
  gap: 14px;
  padding: 24px;
  border: 1px solid var(--so-border);
  border-radius: 18px;
  background: var(--so-bg-elevated);
  box-shadow: var(--so-shadow);
}
.configuration-version-panel {
  width: min(760px, 100%);
}
.source-modal input,
.source-modal select,
.source-modal textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--so-border);
  border-radius: 9px;
  color: var(--so-text);
  background: var(--so-panel-soft);
}
.source-modal header,
.source-modal footer,
.configuration-version-list > li > header,
.configuration-version-list > li > header > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.source-modal h3,
.source-modal p {
  margin: 0;
}
.source-modal label,
.configuration-version-list > li > header > div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.source-modal header > button {
  font-size: 22px;
  color: var(--so-text);
  background: transparent;
}
.source-modal footer {
  justify-content: flex-end;
}
.source-modal footer button:first-child {
  color: var(--so-text);
  background: var(--so-panel-soft);
}
.configuration-version-panel textarea {
  min-height: 72px;
}
.configuration-version-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.configuration-version-list > li {
  padding: 14px;
  border: 1px solid var(--so-border);
  border-radius: 12px;
  background: var(--so-panel-soft);
}
.configuration-version-list ul {
  display: grid;
  gap: 6px;
  margin-top: 12px;
}
.configuration-version-list ul li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.source-state {
  padding: 30px;
  text-align: center;
}
.source-smoke-notice {
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--so-warning) 42%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--so-warning) 10%, transparent);
  font-size: 13px;
  line-height: 1.55;
}
.source-schedule-preview {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--so-border);
  border-radius: 12px;
  background: var(--so-panel-soft);
}
.source-schedule-preview h4,
.source-schedule-preview dl,
.source-schedule-preview dd {
  margin: 0;
}
.source-schedule-preview > p,
.source-schedule-preview dt {
  color: var(--so-text-muted);
}
.source-schedule-preview dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.source-schedule-preview dl > div {
  padding: 10px;
  border-radius: 8px;
  background: var(--so-panel);
}
.source-schedule-preview dd {
  margin-top: 4px;
}
@media (max-width: 760px) {
  .source-schedule-preview dl {
    grid-template-columns: 1fr;
  }
}
</style>
