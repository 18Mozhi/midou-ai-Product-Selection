<script setup lang="ts">
import { ref } from "vue";
import { useProviderSourceDialogFocus } from "./useProviderSourceDialogFocus";
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
  message: string;
  requestId: string;
}>();

const emit = defineEmits<{
  closeEdit: [];
  save: [];
  closeVersions: [];
  rollback: [version: ConfigurationVersion];
  "update:form": [form: ProviderSourceConfigurationForm];
  "update:rollbackReason": [value: string];
}>();

const editDialog = ref<HTMLElement | null>(null);
const editTitle = ref<HTMLElement | null>(null);
const versionDialog = ref<HTMLElement | null>(null);
const versionTitle = ref<HTMLElement | null>(null);
const editFocus = useProviderSourceDialogFocus(
  () => Boolean(props.editing),
  editDialog,
  editTitle,
  () => {
    if (!props.saving) emit("closeEdit");
  },
);
const versionFocus = useProviderSourceDialogFocus(
  () => Boolean(props.versionSource),
  versionDialog,
  versionTitle,
  () => {
    if (props.rollingBack === null) emit("closeVersions");
  },
);

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
    ref="editDialog"
    class="source-modal p48-source-configuration-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="source-edit-title"
    aria-describedby="source-edit-description"
    @keydown="editFocus.onKeydown"
  >
    <form class="p48-source-configuration-form" :aria-busy="saving" @submit.prevent="$emit('save')">
      <header>
        <div>
          <p>来源采集 / 编辑设置</p>
          <h3 id="source-edit-title" ref="editTitle" tabindex="-1">
            采集设置 · {{ editing.name }}
          </h3>
          <p id="source-edit-description">
            调整采集节奏和运行状态。系统会记录本次原因，并保留历史版本。
          </p>
          <div class="p48-source-configuration-meta" aria-label="当前来源信息">
            <span>{{
              editing.access_mode === "authenticated_browser" ? "网页登录来源" : "公开来源"
            }}</span>
            <span>{{
              editing.provisioned?.status === "enabled" ? "当前已启用" : "当前已停用"
            }}</span>
            <span>配置版本 {{ editing.provisioned?.version }}</span>
          </div>
        </div>
        <button
          type="button"
          :aria-label="`关闭 ${editing.name} 采集设置`"
          :disabled="saving"
          @click="$emit('closeEdit')"
        >
          ×
        </button>
      </header>
      <section v-if="message" class="p48-source-dialog-feedback" role="status" aria-live="polite">
        <strong>{{ saving ? "正在保存采集设置" : "采集设置处理结果" }}</strong>
        <p>{{ message }}</p>
        <details v-if="requestId">
          <summary>技术详情</summary>
          <code>{{ requestId }}</code>
        </details>
      </section>
      <label
        >采集频率（分钟）<input
          :value="form.schedule_minutes"
          type="number"
          min="1"
          max="10080"
          required
          aria-describedby="source-edit-schedule-help"
          @input="updateForm('schedule_minutes', Number(($event.target as HTMLInputElement).value))"
        /><small id="source-edit-schedule-help">允许 1–10080 的整数。</small></label
      >
      <label
        >单次超时（毫秒）<input
          :value="form.timeout_ms"
          type="number"
          min="1000"
          max="120000"
          required
          aria-describedby="source-edit-timeout-help"
          @input="updateForm('timeout_ms', Number(($event.target as HTMLInputElement).value))"
        /><small id="source-edit-timeout-help">允许 1000–120000 毫秒的整数。</small></label
      >
      <label
        >失败重试次数<input
          :value="form.retry_limit"
          type="number"
          min="0"
          max="10"
          required
          aria-describedby="source-edit-retry-help"
          @input="updateForm('retry_limit', Number(($event.target as HTMLInputElement).value))"
        /><small id="source-edit-retry-help">允许 0–10 次。</small></label
      >
      <label>
        {{ editing.availability === "automatic" ? "运行状态" : "来源设置状态" }}
        <select
          :value="form.status"
          aria-describedby="source-edit-status-help"
          @change="updateForm('status', ($event.target as HTMLSelectElement).value)"
        >
          <option value="enabled">启用</option>
          <option value="disabled">停用</option></select
        ><small id="source-edit-status-help">网页登录来源仍需完成登录和来源验收后才能运行。</small>
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
          aria-describedby="source-edit-reason-help"
          @input="updateForm('reason', ($event.target as HTMLTextAreaElement).value)"
        ></textarea
        ><small id="source-edit-reason-help">填写 2–500 个字符，说明这次调整的原因。</small>
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
    ref="versionDialog"
    class="source-modal p48-source-versions-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="configuration-version-title"
    @keydown="versionFocus.onKeydown"
  >
    <section
      class="configuration-version-panel p48-source-versions-panel"
      :aria-busy="versionLoading || rollingBack !== null"
    >
      <header class="p48-source-versions-identity">
        <div>
          <p>来源采集 / 配置版本</p>
          <h3 id="configuration-version-title" ref="versionTitle" tabindex="-1">
            版本、差异与回滚 · {{ versionSource.name }}
          </h3>
        </div>
        <button
          type="button"
          aria-label="关闭配置版本"
          :disabled="rollingBack !== null"
          @click="$emit('closeVersions')"
        >
          ×
        </button>
      </header>
      <p>只展示采集频率、超时、重试和启停状态；凭证、Cookie 与受限环境值不会进入版本详情。</p>
      <section v-if="message" class="p48-source-dialog-feedback" role="status" aria-live="polite">
        <strong>{{ rollingBack !== null ? "正在恢复配置版本" : "配置版本处理结果" }}</strong>
        <p>{{ message }}</p>
        <details v-if="requestId">
          <summary>技术详情</summary>
          <code>{{ requestId }}</code>
        </details>
      </section>
      <label class="p48-source-versions-rollback"
        >回滚原因<textarea
          :value="rollbackReason"
          minlength="2"
          maxlength="500"
          required
          :disabled="rollingBack !== null"
          aria-describedby="configuration-rollback-help"
          @input="$emit('update:rollbackReason', ($event.target as HTMLTextAreaElement).value)"
        ></textarea
        ><small id="configuration-rollback-help">填写 2–500 个字符，说明恢复该版本的原因。</small>
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
              :disabled="rollingBack !== null || rollbackReason.trim().length < 2"
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
      <footer class="p48-source-versions-actions">
        <p>恢复会生成新的当前版本，不会改写历史记录。</p>
        <button type="button" :disabled="rollingBack !== null" @click="$emit('closeVersions')">
          关闭
        </button>
      </footer>
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

.source-modal.p48-source-configuration-modal,
.source-modal.p48-source-versions-modal {
  padding: 24px;
  background: rgb(15 23 42 / 72%);
  backdrop-filter: blur(8px);
}
.p48-source-configuration-form,
.p48-source-versions-panel {
  width: min(820px, 100%);
  max-height: calc(100dvh - 48px);
  gap: 0;
  padding: 0;
  overflow: auto;
  border: 1px solid #d3deec;
  border-radius: 20px;
  background: #f7f9fc;
  color: #172033;
  box-shadow: 0 28px 72px rgb(15 23 42 / 28%);
}
.p48-source-configuration-form > header,
.p48-source-versions-identity {
  align-items: flex-start;
  padding: 26px 30px;
  color: #fff;
  background: #164fae;
}
.p48-source-configuration-form > header > div,
.p48-source-versions-identity > div {
  display: grid;
  gap: 8px;
}
.p48-source-configuration-form > header p,
.p48-source-versions-identity p {
  color: rgb(255 255 255 / 82%);
  font-size: 13px;
  line-height: 1.55;
}
.p48-source-configuration-form > header h3,
.p48-source-versions-identity h3 {
  color: #fff;
  font-size: clamp(23px, 3vw, 31px);
  line-height: 1.2;
  outline: none;
}
.p48-source-configuration-form > header > button,
.p48-source-versions-identity > button {
  flex: 0 0 44px;
  width: 44px;
  min-height: 44px;
  border: 1px solid rgb(255 255 255 / 40%);
  border-radius: 10px;
  color: #fff;
  background: rgb(255 255 255 / 10%);
}
.p48-source-configuration-form > header > button:disabled,
.p48-source-versions-identity > button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.p48-source-configuration-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.p48-source-configuration-meta span {
  padding: 6px 10px;
  border: 1px solid rgb(255 255 255 / 32%);
  border-radius: 999px;
  color: #fff;
  font-size: 12px;
}
.p48-source-configuration-form > label,
.p48-source-configuration-form > .source-schedule-preview,
.p48-source-configuration-form > .source-smoke-notice,
.p48-source-configuration-form > .p48-source-dialog-feedback,
.p48-source-versions-panel > .p48-source-dialog-feedback {
  padding: 18px 30px;
  border: 0;
  border-bottom: 1px solid #dce4ef;
  border-radius: 0;
  background: #fff;
}
.p48-source-configuration-form > .p48-source-dialog-feedback,
.p48-source-versions-panel > .p48-source-dialog-feedback {
  display: grid;
  gap: 6px;
  padding-top: 14px;
  padding-bottom: 14px;
  border-left: 4px solid #1769e0;
  color: #344d6a;
  background: #eaf3ff;
}
.p48-source-dialog-feedback p {
  margin: 0;
  line-height: 1.55;
}
.p48-source-dialog-feedback summary {
  min-height: 44px;
  line-height: 44px;
}
.p48-source-dialog-feedback code {
  overflow-wrap: anywhere;
}
.p48-source-configuration-form > label {
  display: grid;
  gap: 8px;
  color: #243247;
  font-size: 14px;
  font-weight: 650;
}
.p48-source-configuration-form input,
.p48-source-configuration-form select,
.p48-source-configuration-form textarea,
.p48-source-versions-panel textarea {
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #aebdd0;
  border-radius: 9px;
  background: #fff;
  color: #172033;
}
.p48-source-configuration-form small,
.p48-source-versions-panel small {
  color: #64748b;
  font-size: 12px;
  font-weight: 450;
  line-height: 1.5;
}
.p48-source-configuration-form textarea,
.p48-source-versions-panel textarea {
  min-height: 88px;
  resize: vertical;
}
.p48-source-configuration-form :focus-visible,
.p48-source-versions-panel :focus-visible {
  outline: 3px solid #66a3ff;
  outline-offset: 3px;
}
.p48-source-configuration-form .source-smoke-notice {
  border-left: 5px solid #d97706;
  color: #6b4a1c;
  background: #fff8e8;
  line-height: 1.6;
}
.p48-source-configuration-form .source-schedule-preview {
  border-bottom: 1px solid #dce4ef;
  background: #edf4ff;
}
.p48-source-configuration-form .source-schedule-preview dl > div {
  border: 1px solid #d6e2f1;
  background: #fff;
}
.p48-source-configuration-form > footer,
.p48-source-versions-actions {
  position: sticky;
  bottom: 0;
  z-index: 2;
  justify-content: space-between;
  padding: 14px 30px;
  border-top: 1px solid #d3deec;
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 -10px 22px rgb(15 23 42 / 6%);
  backdrop-filter: blur(10px);
}
.p48-source-configuration-form > footer p,
.p48-source-versions-actions p {
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}
.p48-source-configuration-form > footer > div {
  display: flex;
  gap: 10px;
}
.p48-source-configuration-form > footer button,
.p48-source-versions-actions button,
.configuration-version-list button {
  min-height: 44px;
  padding: 9px 15px;
  border-radius: 9px;
}
.p48-source-configuration-form > footer button:first-child,
.p48-source-versions-actions button {
  border: 1px solid #aebdd0;
  color: #243247;
  background: #fff;
}
.p48-source-versions-panel {
  width: min(920px, 100%);
}
.p48-source-versions-panel > header > div {
  min-width: 0;
}
.p48-source-versions-panel > p {
  padding: 14px 30px;
  color: #53657d;
  background: #eaf3ff;
  line-height: 1.55;
}
.p48-source-versions-panel > label {
  display: grid;
  gap: 8px;
  padding: 16px 30px;
  border-bottom: 1px solid #dce4ef;
  background: #fff;
  font-weight: 650;
}
.p48-source-versions-panel > .source-state,
.p48-source-versions-panel > p:last-of-type {
  margin: 0;
  padding: 28px 30px;
}
.configuration-version-list {
  gap: 0;
  padding: 0 30px;
  background: #fff;
}
.configuration-version-list > li {
  display: grid;
  gap: 10px;
  padding: 16px 0;
  border: 0;
  border-bottom: 1px solid #dce4ef;
  border-radius: 0;
  background: transparent;
}
.configuration-version-list > li > header > div {
  gap: 5px;
}
.configuration-version-list > li > header strong {
  color: #172033;
  font-size: 16px;
}
.configuration-version-list > li > header span,
.configuration-version-list > li > p {
  color: #64748b;
  font-size: 13px;
}
.configuration-version-list ul {
  gap: 0;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}
.configuration-version-list ul li {
  align-items: baseline;
  padding: 8px 0;
  border-top: 1px solid #edf1f6;
  font-size: 13px;
}
.configuration-version-list code {
  overflow-wrap: anywhere;
  color: #334155;
}
.p48-source-versions-actions {
  display: flex;
  align-items: center;
}
@media (max-width: 760px) {
  .source-modal.p48-source-configuration-modal,
  .source-modal.p48-source-versions-modal {
    align-items: stretch;
    padding: 0;
  }
  .p48-source-configuration-form,
  .p48-source-versions-panel {
    width: 100%;
    max-height: 100dvh;
    border-radius: 0;
  }
  .p48-source-configuration-form > header,
  .p48-source-versions-identity,
  .p48-source-configuration-form > label,
  .p48-source-configuration-form > .source-schedule-preview,
  .p48-source-configuration-form > .source-smoke-notice,
  .p48-source-versions-panel > p,
  .p48-source-versions-panel > label {
    padding-right: 20px;
    padding-left: 20px;
  }
  .p48-source-configuration-form > header h3,
  .p48-source-versions-identity h3 {
    font-size: 25px;
  }
  .p48-source-configuration-form .source-schedule-preview dl {
    grid-template-columns: 1fr;
  }
  .p48-source-configuration-form > footer,
  .p48-source-versions-actions {
    display: grid;
    gap: 8px;
    padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
  }
  .p48-source-configuration-form > footer > div {
    display: grid;
    grid-template-columns: 1fr 1.35fr;
  }
  .p48-source-configuration-form > footer p,
  .p48-source-versions-actions p {
    margin: 0;
  }
  .configuration-version-list {
    padding-right: 20px;
    padding-left: 20px;
  }
  .configuration-version-list > li > header {
    align-items: flex-start;
  }
  .configuration-version-list ul li {
    display: grid;
    gap: 4px;
  }
}
@media (forced-colors: active) {
  .p48-source-configuration-form,
  .p48-source-versions-panel,
  .p48-source-configuration-form > header,
  .p48-source-versions-identity {
    border: 1px solid CanvasText;
  }
}
</style>
