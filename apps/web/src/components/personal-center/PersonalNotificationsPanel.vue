<script setup lang="ts">
import PersonalSectionReadStatus from "./PersonalSectionReadStatus.vue";
import type { ActionFeedback, NotificationPreferences, SectionResource } from "./types";

const props = defineProps<{
  resource: SectionResource<NotificationPreferences>;
  draft: NotificationPreferences | null;
  saving: boolean;
  feedback: ActionFeedback | null;
}>();
const emit = defineEmits<{
  retry: [];
  updatePreference: [field: Exclude<keyof NotificationPreferences, "version">, value: boolean];
  submit: [];
}>();

const options = [
  { field: "in_app_enabled", label: "站内通知" },
  { field: "email_enabled", label: "邮件通知" },
  { field: "task_enabled", label: "任务通知" },
  { field: "approval_enabled", label: "审批通知" },
  { field: "competitor_enabled", label: "竞品通知" },
] as const;
</script>

<template>
  <section class="p11-section">
    <PersonalSectionReadStatus
      :status="props.resource.status"
      title="通知偏好"
      :message="props.resource.message"
      :has-snapshot="Boolean(props.resource.data)"
      :request-id="props.resource.readFailureId"
      :trace-id="props.resource.readFailureTraceId"
      @retry="emit('retry')"
    />
    <form
      v-if="props.resource.data && props.draft"
      class="p11-panel p11-preference-form"
      @submit.prevent="emit('submit')"
    >
      <header class="p11-panel-heading">
        <p>通知偏好</p>
        <h3>五项可保存开关</h3>
        <span>此处保存通知偏好，不代表邮件已送达。</span>
      </header>
      <label v-for="option in options" :key="option.field" class="p11-toggle-row">
        <span>{{ option.label }}</span>
        <input
          type="checkbox"
          :aria-label="option.label"
          :checked="props.draft[option.field]"
          :disabled="props.resource.status !== 'ready' || props.saving"
          @change="
            emit('updatePreference', option.field, ($event.target as HTMLInputElement).checked)
          "
        />
      </label>
      <footer class="p11-form-footer">
        <p
          v-if="props.feedback"
          class="p11-action-feedback"
          :data-status="props.feedback.status"
          role="status"
        >
          {{ props.feedback.message }}
          <small v-if="props.feedback.status === 'error' && props.feedback.requestId">
            请求编号：<code>{{ props.feedback.requestId }}</code>
          </small>
          <small v-if="props.feedback.status === 'error' && props.feedback.traceId">
            追踪编号：<code>{{ props.feedback.traceId }}</code>
          </small>
        </p>
        <button
          class="p11-primary"
          type="submit"
          :disabled="props.resource.status !== 'ready' || props.saving"
        >
          {{ props.saving ? "正在保存…" : "保存偏好" }}
        </button>
      </footer>
    </form>
  </section>
</template>
