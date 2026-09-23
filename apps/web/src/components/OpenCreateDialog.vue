<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{ title: string; confirming: boolean; busy: boolean }>();
const dialog = ref<HTMLDialogElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const waitingForConfirmation = ref(false);
let fieldFocus: HTMLElement | null = null;
let disposed = false;

function open() {
  if (props.busy || props.confirming || !dialog.value || dialog.value.open) return;
  dialog.value.showModal();
  dialog.value.querySelector<HTMLInputElement>("input")?.focus();
}

function close() {
  dialog.value?.close();
  trigger.value?.focus({ preventScroll: true });
}

function keydown(event: KeyboardEvent) {
  if (event.key !== "Tab" || !dialog.value) return;
  const focusable = [
    ...dialog.value.querySelectorAll<HTMLElement>("button,input,select,textarea"),
  ].filter((node) => node.tabIndex >= 0 && !node.matches(":disabled") && node.checkVisibility());
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

watch(
  () => props.confirming,
  async (confirming) => {
    if (confirming && dialog.value?.open) {
      fieldFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      waitingForConfirmation.value = true;
      close();
    } else if (!confirming && waitingForConfirmation.value) {
      waitingForConfirmation.value = false;
      await nextTick();
      if (disposed || props.busy || props.confirming) return;
      open();
      fieldFocus?.focus({ preventScroll: true });
      fieldFocus = null;
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
  <div class="p60-create-launch">
    <p>新增连接需要填写目标组织与变更原因，随后核对影响范围。</p>
    <button
      ref="trigger"
      type="button"
      class="primary"
      :disabled="busy || confirming"
      @click="open"
    >
      {{ title }}
    </button>
  </div>
  <dialog
    ref="dialog"
    class="p60-create-dialog"
    aria-labelledby="p60-create-title"
    @cancel.prevent="close"
    @keydown="keydown"
  >
    <header class="p60-create-heading">
      <div>
        <p>01 填写连接信息 / 02 核对后确认</p>
        <h2 id="p60-create-title">{{ title }}</h2>
        <span>带必填语义的字段均需填写；所有写入沿用原有幂等与审计规则。</span>
      </div>
      <button type="button" @click="close" aria-label="关闭创建填写窗">关闭</button>
    </header>
    <slot />
  </dialog>
</template>
