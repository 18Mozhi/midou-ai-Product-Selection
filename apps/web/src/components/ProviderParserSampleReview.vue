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
    <label>
      审批原因
      <input
        v-model="reason"
        type="text"
        minlength="2"
        maxlength="1000"
        :disabled="!sample.can_review || reviewing"
        :placeholder="sample.can_review ? '填写通过或驳回依据' : '创建人不能审批自己的样本'"
      />
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
.sample-review-actions {
  display: flex;
  justify-content: start;
}
.sample-review-actions .secondary {
  color: var(--so-text);
  background: var(--so-panel-soft);
}
</style>
