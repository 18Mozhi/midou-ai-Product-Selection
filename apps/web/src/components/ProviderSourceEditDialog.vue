<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useProviderSourceDialogFocus } from "./useProviderSourceDialogFocus";
import type {
  ProviderSourceConfigurationForm,
  ProviderSourceConfigurationPreview,
  ProviderSourceItem,
} from "./provider-source-types";

const props = defineProps<{
  editing: ProviderSourceItem | null;
  form: ProviderSourceConfigurationForm;
  preview: ProviderSourceConfigurationPreview | null;
  saving: boolean;
  saveStage: string;
  saveTitle: string;
  saveDescription: string;
  saveRequestId: string;
}>();

const emit = defineEmits<{
  closeEdit: [];
  acknowledge: [];
  save: [];
  "update:form": [form: ProviderSourceConfigurationForm];
}>();

const editDialog = ref<HTMLElement | null>(null);
const editTitle = ref<HTMLElement | null>(null);
const saveFeedbackTitle = ref<HTMLElement | null>(null);

function closeEditDialog() {
  if (props.saving) return;
  if (["success", "partial", "conflict"].includes(props.saveStage)) emit("acknowledge");
  else emit("closeEdit");
}

const editFocus = useProviderSourceDialogFocus(
  () => Boolean(props.editing),
  editDialog,
  editTitle,
  closeEditDialog,
);

watch(
  () => props.saveStage,
  async (stage) => {
    if (!["success", "partial", "failed", "conflict"].includes(stage)) return;
    await nextTick();
    saveFeedbackTitle.value?.focus({ preventScroll: true });
  },
  { flush: "post" },
);

const updateForm = (field: keyof ProviderSourceConfigurationForm, value: string | number) =>
  emit("update:form", { ...props.form, [field]: value });
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
          @click="closeEditDialog"
        >
          ×
        </button>
      </header>
      <section
        v-if="saveStage !== 'idle'"
        class="p48-source-configuration-save-feedback"
        :data-stage="saveStage"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        :aria-busy="['saving', 'saving_disabled', 'smoke_testing', 'enabling'].includes(saveStage)"
      >
        <p>
          {{
            ["saving", "saving_disabled", "smoke_testing", "enabling"].includes(saveStage)
              ? "正在处理"
              : "处理结果"
          }}
        </p>
        <h4 ref="saveFeedbackTitle" tabindex="-1">{{ saveTitle }}</h4>
        <p>{{ saveDescription }}</p>
        <details v-if="saveRequestId && ['partial', 'failed', 'conflict'].includes(saveStage)">
          <summary>技术详情</summary>
          <code>{{ saveRequestId }}</code>
        </details>
      </section>
      <label
        >采集频率（分钟）<input
          :value="form.schedule_minutes"
          type="number"
          min="1"
          max="10080"
          required
          :disabled="saving"
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
          :disabled="saving"
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
          :disabled="saving"
          aria-describedby="source-edit-retry-help"
          @input="updateForm('retry_limit', Number(($event.target as HTMLInputElement).value))"
        /><small id="source-edit-retry-help">允许 0–10 次。</small></label
      >
      <label>
        {{ editing.availability === "automatic" ? "运行状态" : "来源设置状态" }}
        <select
          :value="form.status"
          :disabled="saving"
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
          :disabled="saving"
          minlength="2"
          maxlength="500"
          required
          aria-describedby="source-edit-reason-help"
          @input="updateForm('reason', ($event.target as HTMLTextAreaElement).value)"
        ></textarea
        ><small id="source-edit-reason-help">填写 2–500 个字符，说明这次调整的原因。</small>
      </label>
      <footer>
        <p>
          {{
            saveStage === "success" || saveStage === "partial" || saveStage === "conflict"
              ? "结果已确认，关闭后同步来源目录"
              : requiresSmokeTest(editing, form)
                ? "将先保存停用版，再进行烟测"
                : "保存后会生成新的配置版本"
          }}
        </p>
        <button
          v-if="['success', 'partial', 'conflict'].includes(saveStage)"
          type="button"
          @click="closeEditDialog"
        >
          {{
            saveStage === "success" ? "完成" : saveStage === "conflict" ? "关闭后重新读取" : "关闭"
          }}
        </button>
        <template v-else>
          <button type="button" :disabled="saving" @click="closeEditDialog">取消</button>
          <button :disabled="saving">
            {{
              saving
                ? saveStage === "smoke_testing"
                  ? "正在烟测…"
                  : saveStage === "enabling"
                    ? "正在启用…"
                    : "正在保存…"
                : saveStage === "idle"
                  ? requiresSmokeTest(editing, form)
                    ? "烟测并启用"
                    : "保存配置"
                  : "重新保存"
            }}
          </button>
        </template>
      </footer>
    </form>
  </div>
</template>
