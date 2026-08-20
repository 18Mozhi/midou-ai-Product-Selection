<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { canConfirm } from "../ui/state-contract";
const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description: string;
    impact: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    confirmationText?: string;
  }>(),
  { confirmLabel: "确认", cancelLabel: "取消", destructive: false, confirmationText: "" },
);
const emit = defineEmits<{ confirm: []; cancel: [] }>();
const acknowledged = ref(false),
  typedText = ref(""),
  dialog = ref<HTMLElement | null>(null),
  cancelButton = ref<HTMLButtonElement | null>(null);
const enabled = computed(() =>
  canConfirm({
    destructive: props.destructive,
    acknowledged: acknowledged.value,
    confirmationText: props.confirmationText,
    typedText: typedText.value,
  }),
);
watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    acknowledged.value = false;
    typedText.value = "";
    await nextTick();
    cancelButton.value?.focus();
  },
);
function cancel() {
  emit("cancel");
}
function keydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    cancel();
    return;
  }
  if (event.key !== "Tab" || !dialog.value) return;
  const focusable = [
    ...dialog.value.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled])"),
  ];
  if (!focusable.length) return;
  const first = focusable[0],
    last = focusable[focusable.length - 1];
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
  <Teleport to="body"
    ><div v-if="open" class="confirm-backdrop" @mousedown.self="cancel">
      <section
        ref="dialog"
        class="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        @keydown="keydown"
      >
        <span :data-tone="destructive ? 'danger' : 'info'" aria-hidden="true">{{
          destructive ? "!" : "i"
        }}</span>
        <p>{{ destructive ? "HIGH IMPACT ACTION" : "CONFIRM ACTION" }}</p>
        <h2 id="confirm-title">{{ title }}</h2>
        <div id="confirm-description">{{ description }}</div>
        <aside>
          <strong>影响范围</strong>
          <p>{{ impact }}</p>
        </aside>
        <label v-if="destructive" class="confirm-check"
          ><input
            v-model="acknowledged"
            type="checkbox"
          />我已阅读影响范围，并确认只处理上述对象</label
        ><label v-if="confirmationText" class="confirm-phrase"
          >输入 <code>{{ confirmationText }}</code> 继续<input
            v-model="typedText"
            autocomplete="off"
            :placeholder="confirmationText"
        /></label>
        <footer>
          <button ref="cancelButton" type="button" @click="cancel">{{ cancelLabel }}</button
          ><button
            class="confirm-submit"
            :class="{ 'is-danger': destructive }"
            type="button"
            :disabled="!enabled"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </button>
        </footer>
      </section>
    </div></Teleport
  >
</template>
