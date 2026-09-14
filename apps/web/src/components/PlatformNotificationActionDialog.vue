<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useModalDialog } from "../use-modal-dialog";

const props = defineProps<{
  open: boolean;
  target: { title: string; version: number } | null;
  action: "publish" | "cancel";
  error: string;
  submitting: boolean;
}>();
const reason = defineModel<string>("reason", { required: true });
const emit = defineEmits<{ close: []; submit: [] }>();
const reasonElement = ref<HTMLTextAreaElement | null>(null);
const { dialogElement, handleCancel } = useModalDialog(
  () => props.open,
  () => emit("close"),
);
watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    await nextTick();
    reasonElement.value?.focus();
  },
);
function handleTab(event: KeyboardEvent) {
  if (event.key !== "Tab" || !dialogElement.value) return;
  const controls = [...dialogElement.value.querySelectorAll<HTMLElement>("button,textarea")].filter(
    (element) => !element.matches(":disabled") && element.getClientRects().length,
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
    class="notification-action-dialog"
    :aria-label="action === 'publish' ? '填写发布原因' : '填写取消草稿原因'"
    @cancel="handleCancel"
    @keydown="handleTab"
  >
    <form @submit.prevent="$emit('submit')">
      <header>
        <div>
          <small>{{ action === "publish" ? "PUBLISH DRAFT" : "CANCEL DRAFT" }}</small>
          <h3>{{ action === "publish" ? "发布这条草稿" : "取消这条草稿" }}</h3>
        </div>
        <button type="button" aria-label="关闭原因填写" @click="$emit('close')">×</button>
      </header>
      <section class="notification-action-dialog__target">
        <strong>{{ target?.title }}</strong>
        <span>提交版本 v{{ target?.version }}</span>
      </section>
      <p>
        {{
          action === "publish"
            ? "发布会按当前受众生成站内通知，实际人数以接口返回为准。"
            : "取消只终止当前草稿，不会撤回已经发布的消息。"
        }}
      </p>
      <label>
        操作原因
        <textarea
          ref="reasonElement"
          v-model="reason"
          required
          minlength="2"
          maxlength="300"
          rows="5"
          :disabled="submitting"
          aria-describedby="notification-action-reason-help"
        ></textarea>
      </label>
      <small id="notification-action-reason-help"
        >已输入 {{ reason.length }} / 300 字；至少 2 个字。</small
      >
      <p v-if="error" class="notification-action-dialog__error" role="alert">{{ error }}</p>
      <footer>
        <button type="button" @click="$emit('close')">取消</button>
        <button
          type="submit"
          :class="{ 'is-danger': action === 'cancel' }"
          :disabled="submitting || reason.trim().length < 2 || reason.trim().length > 300"
        >
          {{ submitting ? "提交中…" : action === "publish" ? "确认发布" : "确认取消草稿" }}
        </button>
      </footer>
    </form>
  </dialog>
</template>
