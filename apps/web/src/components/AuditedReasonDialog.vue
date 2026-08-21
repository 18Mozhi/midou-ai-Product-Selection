<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useModalDialog } from "../use-modal-dialog";

const props = defineProps<{
  open: boolean;
  title: string;
  description: string;
  initialValue?: string;
  minimumLength?: number;
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
</script>

<template>
  <dialog
    ref="dialogElement"
    class="audited-reason-dialog"
    :aria-label="title"
    @cancel="handleCancel"
  >
    <form @submit.prevent="submit">
      <header>
        <div>
          <p>审计原因</p>
          <h3>{{ title }}</h3>
        </div>
        <button type="button" aria-label="关闭原因填写" @click="$emit('cancel')">×</button>
      </header>
      <p>{{ description }}</p>
      <label>
        原因（至少 {{ minimumLength ?? 2 }} 个字）
        <textarea
          ref="inputElement"
          v-model="reason"
          required
          :minlength="minimumLength ?? 2"
          rows="4"
          aria-describedby="audited-reason-help"
        ></textarea>
      </label>
      <small id="audited-reason-help">提交后会与操作者、时间和目标对象一起保留。</small>
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
</style>
