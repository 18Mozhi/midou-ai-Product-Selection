<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{
  open: boolean;
  title: string;
  description: string;
  impact: string;
  value: string;
  error: string;
}>();
const emit = defineEmits<{
  cancel: [];
  confirm: [value: string];
  "update:value": [value: string];
}>();
const dialog = ref<HTMLDialogElement | null>(null);
const reasonInput = ref<HTMLTextAreaElement | null>(null);
let returnFocus: HTMLElement | null = null;
let disposed = false;

function keydown(event: KeyboardEvent) {
  if (event.key !== "Tab" || !dialog.value) return;
  const focusable = [...dialog.value.querySelectorAll<HTMLElement>("button,input,textarea")].filter(
    (node) => node.tabIndex >= 0 && !node.matches(":disabled") && node.checkVisibility(),
  );
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function cancel() {
  emit("cancel");
}

watch(
  () => props.open,
  async (open) => {
    if (open && dialog.value && !dialog.value.open) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.value.showModal();
      await nextTick();
      reasonInput.value?.focus();
    } else if (!open && dialog.value?.open) {
      dialog.value.close();
      await nextTick();
      if (disposed || document.querySelector(".confirm-backdrop")) return;
      returnFocus?.focus({ preventScroll: true });
      returnFocus = null;
    }
  },
  { flush: "sync" },
);

onBeforeUnmount(() => {
  disposed = true;
  dialog.value?.close();
});
</script>

<template>
  <dialog
    ref="dialog"
    class="p60-action-dialog"
    aria-labelledby="p60-action-title"
    @cancel.prevent="cancel"
    @keydown="keydown"
  >
    <header class="p60-action-heading">
      <div>
        <p>01 填写本次原因 / 02 冻结对象并确认</p>
        <h2 id="p60-action-title">{{ title }}</h2>
        <span>{{ description }}</span>
      </div>
      <button type="button" aria-label="关闭操作原因窗口" @click="cancel">关闭</button>
    </header>
    <section class="p60-action-summary" aria-label="操作影响">
      <strong>影响范围</strong>
      <p>{{ impact }}</p>
    </section>
    <form class="p60-action-form" @submit.prevent="emit('confirm', value)">
      <label for="p60-action-reason">本次变更原因</label>
      <textarea
        id="p60-action-reason"
        ref="reasonInput"
        :value="value"
        required
        minlength="1"
        maxlength="500"
        aria-describedby="p60-action-reason-help p60-action-reason-error"
        :aria-invalid="Boolean(error)"
        @input="emit('update:value', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
      <small id="p60-action-reason-help">填写 1–500 个字符；此原因会随操作写入审计记录。</small>
      <small v-if="error" id="p60-action-reason-error" class="field-error" role="alert">
        {{ error }}
      </small>
      <footer>
        <button type="button" @click="cancel">取消</button>
        <button class="primary" type="submit" :disabled="!value.trim()">继续核对</button>
      </footer>
    </form>
  </dialog>
</template>
