<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  sample: {
    id: string;
    can_review: boolean;
  };
  reviewing: boolean;
}>();

const emit = defineEmits<{
  review: [decision: "approved" | "rejected", reason: string];
}>();

const reason = ref("");
const submit = (decision: "approved" | "rejected") => {
  const normalizedReason = reason.value.trim();
  if (!props.sample.can_review || normalizedReason.length < 2) return;
  emit("review", decision, normalizedReason);
};
</script>

<template>
  <div class="sample-review">
    <label :for="`sample-review-reason-${sample.id}`">
      <span>审批原因</span>
      <input
        :id="`sample-review-reason-${sample.id}`"
        v-model="reason"
        type="text"
        minlength="2"
        maxlength="1000"
        :disabled="!sample.can_review || reviewing"
        :aria-describedby="`sample-review-help-${sample.id}`"
        :placeholder="sample.can_review ? '填写通过或驳回依据' : '创建人不能审批自己的样本'"
      />
      <small :id="`sample-review-help-${sample.id}`">
        {{
          sample.can_review
            ? "填写 2–1000 个字符的审批依据；创建人不能复核自己的样本。"
            : "需要由另一位管理员完成复核。"
        }}
      </small>
    </label>
    <div v-if="sample.can_review" class="sample-review-actions">
      <button
        type="button"
        :disabled="reviewing || reason.trim().length < 2"
        @click="submit('approved')"
      >
        审批通过
      </button>
      <button
        type="button"
        class="secondary"
        :disabled="reviewing || reason.trim().length < 2"
        @click="submit('rejected')"
      >
        驳回样本
      </button>
    </div>
  </div>
</template>

<style scoped>
.sample-review,
.sample-review label {
  display: grid;
  gap: 8px;
}
.sample-review input {
  min-width: min(420px, 62vw);
}
.sample-review label > span {
  color: #243247;
  font-weight: 650;
}
.sample-review small {
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}
.sample-review input:focus-visible,
.sample-review button:focus-visible {
  outline: 3px solid #66a3ff;
  outline-offset: 3px;
}
.sample-review-actions {
  display: flex;
  justify-content: start;
}
.sample-review-actions .secondary {
  color: var(--so-text);
  background: var(--so-panel-soft);
}
</style>
