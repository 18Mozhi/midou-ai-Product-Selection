<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useModalDialog } from "../use-modal-dialog";
import { containDialogTab } from "../ui/contain-dialog-tab";

type DecisionAction = "adopt" | "observe" | "reject";
const props = defineProps<{
    busy: boolean;
    decisionAction: DecisionAction;
    hasDetail: boolean;
  }>(),
  emit = defineEmits<{
    decide: [];
  }>(),
  decisionOpen = defineModel<boolean>("decisionOpen", { required: true }),
  decisionReason = defineModel<string>("decisionReason", { required: true }),
  decisionReasonValidationAttempted = ref(false),
  { dialogElement: decisionDialog, handleCancel: cancelDecision } = useModalDialog(
    () => decisionOpen.value && props.hasDetail,
    () => (decisionOpen.value = false),
  );
const decisionReasonInvalid = computed(
  () => decisionReasonValidationAttempted.value && decisionReason.value.length === 0,
);

watch(decisionOpen, (open) => {
  if (open) decisionReasonValidationAttempted.value = false;
});

function handleDecisionInvalid(event: Event) {
  if (event.target instanceof HTMLTextAreaElement) decisionReasonValidationAttempted.value = true;
}

const decisionLabel = {
  adopt: "采纳",
  observe: "继续观察",
  reject: "驳回",
} as const;
</script>

<template>
  <dialog
    v-if="decisionOpen && hasDetail"
    ref="decisionDialog"
    class="opportunity-modal"
    aria-labelledby="opportunity-decision-dialog-title"
    @cancel="cancelDecision"
    @keydown="containDialogTab($event, decisionDialog)"
  >
    <form
      class="so-dialog-manifest"
      @submit.prevent="emit('decide')"
      @invalid.capture="handleDecisionInvalid"
    >
      <header>
        <div>
          <p>留痕决策</p>
          <h3 id="opportunity-decision-dialog-title">
            记录{{ decisionLabel[decisionAction] }}决定
          </h3>
        </div>
        <button
          class="so-action-quiet"
          type="button"
          aria-label="关闭"
          @click="decisionOpen = false"
        >
          ×
        </button>
      </header>
      <label
        >原因（必填）<textarea
          v-model="decisionReason"
          required
          maxlength="1000"
          :aria-invalid="decisionReasonInvalid ? 'true' : undefined"
          :aria-describedby="
            decisionReasonInvalid
              ? 'opportunity-decision-reason-help opportunity-decision-reason-error'
              : 'opportunity-decision-reason-help'
          "
        />
      </label>
      <small id="opportunity-decision-reason-help">填写决定依据，最多 1000 个字符。</small>
      <p
        v-if="decisionReasonInvalid"
        id="opportunity-decision-reason-error"
        class="opportunity-field-error"
        role="alert"
      >
        请填写原因后再记录决定。
      </p>
      <aside>此决定会覆盖推荐展示，但不会改写原始分数、证据或历史。</aside>
      <footer>
        <button class="so-action-secondary" type="button" @click="decisionOpen = false">
          取消
        </button>
        <button
          :class="decisionAction === 'reject' ? 'so-action-danger' : 'so-action-primary'"
          type="submit"
          :disabled="busy"
        >
          {{ busy ? "保存中…" : "确认记录" }}
        </button>
      </footer>
    </form>
  </dialog>
</template>
