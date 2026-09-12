<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useModalDialog } from "../use-modal-dialog";
import type { WorkspaceRestoreReasonContext } from "../use-audited-reason";
import "../design/workspace-restore-tokens.css";

const props = defineProps<{
  open: boolean;
  title: string;
  description: string;
  initialValue?: string;
  minimumLength?: number;
  maximumLength?: number;
  workspaceRestore?: WorkspaceRestoreReasonContext;
}>();
const emit = defineEmits<{ submit: [value: string]; cancel: [] }>();
const reason = ref("");
const inputElement = ref<HTMLTextAreaElement | null>(null);
const { dialogElement, handleCancel } = useModalDialog(
  () => props.open,
  () => emit("cancel"),
);

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    reason.value = props.initialValue ?? "";
    await nextTick();
    inputElement.value?.focus();
  },
);

function submit() {
  const value = reason.value.trim();
  if (value.length < (props.minimumLength ?? 2)) return;
  emit("submit", value);
}

function handleTab(event: KeyboardEvent) {
  if (event.key !== "Tab" || !props.open || !dialogElement.value) return;
  const controls = [...dialogElement.value.querySelectorAll<HTMLElement>("button,textarea")].filter(
    (element) =>
      !element.matches(":disabled") && element.tabIndex >= 0 && element.getClientRects().length > 0,
  );
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
    class="audited-reason-dialog"
    :class="{ 'workspace-restore-reason': Boolean(workspaceRestore) }"
    :aria-label="title"
    :aria-describedby="workspaceRestore ? 'workspace-restore-target' : undefined"
    @cancel="handleCancel"
    @keydown="handleTab"
  >
    <form @submit.prevent="submit">
      <header>
        <div>
          <p v-if="!workspaceRestore">审计原因</p>
          <h3>{{ title }}</h3>
        </div>
        <button type="button" aria-label="关闭原因填写" @click="$emit('cancel')">
          {{ workspaceRestore ? "关闭" : "×" }}
        </button>
      </header>
      <section v-if="workspaceRestore" id="workspace-restore-target">
        <strong>{{ workspaceRestore.name }}</strong>
        <p>恢复授权范围内的使用，不自动恢复已移除的成员或团队。</p>
        <p>
          第 {{ workspaceRestore.version ?? "未提供" }} 版；明确范围成员
          {{ workspaceRestore.memberCount ?? "未提供" }}。
        </p>
      </section>
      <p v-else>{{ description }}</p>
      <label>
        原因（至少 {{ minimumLength ?? 2 }} 个字<span v-if="maximumLength"
          >，最多 {{ maximumLength }} 个字</span
        >）
        <textarea
          ref="inputElement"
          v-model="reason"
          required
          :minlength="minimumLength ?? 2"
          :maxlength="maximumLength"
          rows="4"
          aria-describedby="audited-reason-help"
        ></textarea>
      </label>
      <small id="audited-reason-help"
        >提交后会与操作者、时间和目标对象一起保留。<span v-if="maximumLength"
          >已输入 {{ reason.length }} / {{ maximumLength }} 字。</span
        ></small
      >
      <footer>
        <button type="button" @click="$emit('cancel')">取消</button>
        <button type="submit" :disabled="reason.trim().length < (minimumLength ?? 2)">
          确认提交
        </button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
.audited-reason-dialog {
  width: min(520px, calc(100vw - 24px));
  max-height: calc(100dvh - 32px);
  padding: 0;
  border: 1px solid var(--so-border);
  border-radius: 16px;
  background: var(--so-bg-elevated);
  color: var(--so-text);
}
.audited-reason-dialog::backdrop {
  background: var(--so-overlay);
}
form {
  display: grid;
  gap: 14px;
  padding: 20px;
}
header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
header p,
header h3,
form > p,
small {
  margin: 0;
}
small span {
  display: block;
  margin-top: 4px;
}
header > button {
  min-width: 40px;
  min-height: 40px;
}
label {
  display: grid;
  gap: 8px;
}
textarea {
  width: 100%;
  resize: vertical;
}
footer {
  justify-content: flex-end;
}
.audited-reason-dialog.workspace-restore-reason {
  width: min(700px, calc(100vw - 36px));
  max-height: calc(100dvh - 36px);
  border: 0;
  border-radius: 12px;
  background: var(--so-restore-surface);
  color: var(--so-restore-text);
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
  font-size: 16px;
  line-height: 1.6;
}
.audited-reason-dialog.workspace-restore-reason form {
  gap: 18px;
  padding: 20px 18px 16px;
}
.audited-reason-dialog.workspace-restore-reason header {
  padding-bottom: 20px;
  border-bottom: 1px solid var(--so-restore-line);
}
.audited-reason-dialog.workspace-restore-reason h3 {
  font-family: inherit;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--so-restore-text);
}
.audited-reason-dialog.workspace-restore-reason #workspace-restore-target {
  padding: 18px;
  background: var(--so-restore-target);
  overflow-wrap: anywhere;
}
.audited-reason-dialog.workspace-restore-reason #workspace-restore-target strong {
  font-size: 20px;
}
.audited-reason-dialog.workspace-restore-reason #workspace-restore-target p {
  margin: 8px 0 0;
  font-size: 16px;
}
.audited-reason-dialog.workspace-restore-reason label {
  gap: 6px;
  font-size: 16px;
}
.audited-reason-dialog.workspace-restore-reason textarea {
  min-height: 150px;
  padding: 10px 12px;
  border: 1px solid var(--so-restore-input-border);
  border-radius: 6px;
  background: var(--so-restore-surface);
  color: var(--so-restore-text);
  font: inherit;
}
.audited-reason-dialog.workspace-restore-reason small {
  color: var(--so-restore-help);
  font-size: 16px;
}
.audited-reason-dialog.workspace-restore-reason button {
  min-width: 44px;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--so-restore-input-border);
  border-radius: 6px;
  background: var(--so-restore-surface);
  color: var(--so-restore-text);
  font: inherit;
  box-shadow: none;
}
.audited-reason-dialog.workspace-restore-reason footer {
  gap: 12px;
  margin-top: 0;
  padding-top: 16px;
  border-top: 1px solid var(--so-restore-line);
}
.audited-reason-dialog.workspace-restore-reason footer button {
  flex: 1;
  color: var(--so-restore-primary);
}
.audited-reason-dialog.workspace-restore-reason button[type="submit"] {
  background: var(--so-restore-primary);
  color: var(--so-restore-on-primary);
  border-color: var(--so-restore-primary);
}
.audited-reason-dialog.workspace-restore-reason button:disabled {
  opacity: 1;
  background: var(--so-restore-disabled-bg);
  color: var(--so-restore-disabled-text);
  border-color: var(--so-restore-disabled-border);
  cursor: not-allowed;
}
.audited-reason-dialog.workspace-restore-reason :is(button, textarea):focus-visible {
  outline: 3px solid var(--so-restore-focus);
  outline-offset: 3px;
  box-shadow: 0 0 0 2px var(--so-restore-surface);
}
</style>
