<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useModalDialog } from "../use-modal-dialog";
import type {
  PlatformNotificationForm,
  PlatformNotificationMessage,
} from "./platform-notification-types";
import "./platform-message-editor.css";

const props = withDefaults(
  defineProps<{
    open: boolean;
    editor: PlatformNotificationMessage | { id: "" } | null;
    form: PlatformNotificationForm;
    saving: boolean;
    error?: string;
    audienceOptions?: { organizations?: any[]; users?: any[] };
  }>(),
  { error: "" },
);
const emit = defineEmits<{ close: []; save: [] }>();
const titleElement = ref<HTMLInputElement | null>(null);
const { dialogElement, handleCancel } = useModalDialog(
  () => props.open,
  () => emit("close"),
);
watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    await nextTick();
    titleElement.value?.focus();
  },
);
function handleTab(event: KeyboardEvent) {
  if (event.key !== "Tab" || !dialogElement.value) return;
  const controls = [
    ...dialogElement.value.querySelectorAll<HTMLElement>("button,input,select,textarea"),
  ].filter((element) => !element.matches(":disabled") && element.getClientRects().length);
  const first = controls[0],
    last = controls.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
</script>

<template>
  <dialog
    ref="dialogElement"
    class="message-dialog"
    :aria-label="editor?.id ? '编辑平台消息草稿' : '新建平台消息草稿'"
    @cancel="handleCancel"
    @keydown="handleTab"
  >
    <form @submit.prevent="$emit('save')">
      <header>
        <div>
          <small>{{ editor?.id ? "EDIT DRAFT" : "NEW DRAFT" }}</small>
          <h3>平台通知</h3>
          <p>
            {{
              editor?.id
                ? `按 v${form.expected_version} 提交完整草稿值。`
                : "保存后仍是草稿，不会自动发布。"
            }}
          </p>
        </div>
        <button type="button" aria-label="关闭草稿编辑" @click="$emit('close')">×</button>
      </header>
      <ol class="message-dialog__steps" aria-label="草稿编辑步骤">
        <li><b>01</b><span>消息内容</span></li>
        <li><b>02</b><span>级别与受众</span></li>
        <li><b>03</b><span>渠道与保存</span></li>
      </ol>
      <section class="message-dialog__fields">
        <label
          >标题<input
            ref="titleElement"
            v-model="form.title"
            required
            minlength="2"
            maxlength="200"
            :disabled="saving"
            placeholder="接收人看到的标题"
          /><small>已输入 {{ form.title.length }} / 200 字；至少 2 个字。</small></label
        >
        <label
          >正文<textarea
            v-model="form.body"
            required
            minlength="2"
            maxlength="2000"
            rows="7"
            :disabled="saving"
            placeholder="写清楚事项、影响和需要采取的行动"
          ></textarea
          ><small>纯文本并保留换行；已输入 {{ form.body.length }} / 2000 字。</small></label
        >
        <div class="message-form-grid">
          <label
            >消息类型<select v-model="form.category" :disabled="saving">
              <option value="system">系统通知</option>
              <option value="task">任务通知</option>
              <option value="approval">审批通知</option>
              <option value="competitor">竞品通知</option>
            </select></label
          >
          <label
            >重要程度<select v-model="form.severity" :disabled="saving">
              <option value="info">普通</option>
              <option value="warning">重要</option>
              <option value="critical">严重</option>
            </select></label
          >
        </div>
        <label
          >接收范围<select v-model="form.audience_type" :disabled="saving">
            <option value="all_users">全部活动用户</option>
            <option value="organization">指定组织</option>
            <option value="user">指定用户</option></select
          ><small>候选列表不是实时受众预检，实际人数以发布结果为准。</small></label
        >
        <label v-if="form.audience_type === 'organization'"
          >选择组织<select v-model="form.organization_id" required :disabled="saving">
            <option value="">请选择</option>
            <option
              v-for="item in audienceOptions?.organizations || []"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }}
            </option></select
          ><small v-if="!audienceOptions?.organizations?.length"
            >当前读取结果没有可选组织。</small
          ></label
        >
        <label v-if="form.audience_type === 'user'"
          >选择用户<select v-model="form.user_id" required :disabled="saving">
            <option value="">请选择</option>
            <option v-for="item in audienceOptions?.users || []" :key="item.id" :value="item.id">
              {{ item.email }}
            </option></select
          ><small v-if="!audienceOptions?.users?.length">当前读取结果没有可选用户。</small></label
        >
        <fieldset :disabled="saving">
          <legend>发送方式</legend>
          <label><input v-model="form.in_app_enabled" type="checkbox" required />站内通知</label
          ><label
            ><input
              v-model="form.email_enabled"
              type="checkbox"
              disabled
            />邮件（服务未接入）</label
          >
        </fieldset>
        <label v-if="editor?.id"
          >修改原因<textarea
            v-model="form.reason"
            required
            minlength="2"
            maxlength="300"
            rows="3"
            :disabled="saving"
          ></textarea
          ><small
            >已输入 {{ form.reason.length }} / 300 字；会与版本和操作者一起记录。</small
          ></label
        >
        <p class="dialog-help">邮件服务尚未接入，当前只能发布站内通知；历史邮件事实仍保留。</p>
        <p v-if="error" class="message-dialog__error" role="alert">{{ error }}</p>
      </section>
      <footer>
        <button type="button" @click="$emit('close')">关闭</button
        ><button type="submit" :disabled="saving">{{ saving ? "保存中…" : "保存草稿" }}</button>
      </footer>
    </form>
  </dialog>
</template>
