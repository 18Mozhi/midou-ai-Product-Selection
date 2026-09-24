<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useProviderSourceDialogFocus } from "./useProviderSourceDialogFocus";
import type {
  ConfigurationChange,
  ConfigurationVersion,
  ProviderSourceItem,
} from "./provider-source-types";

const props = defineProps<{
  versionSource: ProviderSourceItem | null;
  versionLoading: boolean;
  versionHistory: ConfigurationVersion[];
  versionActionStage: string;
  versionActionTitle: string;
  versionActionDescription: string;
  versionActionRequestId: string;
  versionWriteConfirmed: boolean;
  rollingBack: number | null;
  rollbackReason: string;
}>();

const emit = defineEmits<{
  closeVersions: [];
  retryVersions: [];
  rollback: [version: ConfigurationVersion];
  "update:rollbackReason": [value: string];
}>();

const versionDialog = ref<HTMLElement | null>(null);
const versionTitle = ref<HTMLElement | null>(null);
const versionActionHeading = ref<HTMLElement | null>(null);
const versionFocus = useProviderSourceDialogFocus(
  () => Boolean(props.versionSource),
  versionDialog,
  versionTitle,
  () => {
    if (props.rollingBack === null) emit("closeVersions");
  },
);

watch(
  () => props.versionActionStage,
  async (stage) => {
    if (
      !["success", "sync_failed", "read_failed", "conflict", "forbidden", "failed"].includes(stage)
    )
      return;
    await nextTick();
    versionActionHeading.value?.focus({ preventScroll: true });
  },
  { flush: "post" },
);

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
</script>

<template>
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
      :aria-busy="versionLoading || rollingBack !== null || versionActionStage === 'reloading'"
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
      <section
        v-if="versionActionStage !== 'idle'"
        class="p48-source-version-action-feedback"
        :data-stage="versionActionStage"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        :aria-busy="['submitting', 'reloading'].includes(versionActionStage)"
      >
        <p>
          {{ ["submitting", "reloading"].includes(versionActionStage) ? "正在处理" : "处理结果" }}
        </p>
        <h4 ref="versionActionHeading" tabindex="-1">{{ versionActionTitle }}</h4>
        <p>{{ versionActionDescription }}</p>
        <details
          v-if="
            versionActionRequestId &&
            ['sync_failed', 'read_failed', 'conflict', 'forbidden', 'failed'].includes(
              versionActionStage,
            )
          "
        >
          <summary>技术详情</summary>
          <code>{{ versionActionRequestId }}</code>
        </details>
        <button
          v-if="['sync_failed', 'read_failed', 'conflict', 'failed'].includes(versionActionStage)"
          type="button"
          :disabled="versionLoading || rollingBack !== null || versionActionStage === 'reloading'"
          @click="$emit('retryVersions')"
        >
          {{
            versionWriteConfirmed
              ? "重新核对目录与历史"
              : versionActionStage === "conflict"
                ? "读取最新配置"
                : "重新读取配置历史"
          }}
        </button>
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
      <div v-if="versionLoading || versionActionStage === 'reloading'" class="source-state">
        {{ versionActionStage === "reloading" ? "正在核对目录与历史…" : "正在读取配置版本…" }}
      </div>
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
