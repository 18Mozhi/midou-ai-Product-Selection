<script setup lang="ts">
import { computed } from "vue";
import {
  DEFAULT_STATE_COPY,
  sanitizeCorrelationId,
  type UiStateKind,
} from "../ui/state-contract";
const props = withDefaults(
  defineProps<{
    kind: UiStateKind;
    title?: string;
    description?: string;
    actionHint?: string;
    primaryLabel?: string;
    secondaryLabel?: string;
    requestId?: string;
    traceId?: string;
    compact?: boolean;
  }>(),
  {
    title: "",
    description: "",
    actionHint: "",
    primaryLabel: "",
    secondaryLabel: "",
    requestId: "",
    traceId: "",
    compact: false,
  },
);
const emit = defineEmits<{ primary: []; secondary: [] }>();
const copy = computed(() => DEFAULT_STATE_COPY[props.kind]);
const safeRequest = computed(() => sanitizeCorrelationId(props.requestId)),
  safeTrace = computed(() => sanitizeCorrelationId(props.traceId));
const symbol = computed(
  () =>
    ({
      loading: "···",
      empty: "○",
      error: "!",
      forbidden: "⊘",
      expired: "⌛",
      blocked: "Ⅱ",
      recovery: "✓",
      not_found: "404",
    })[props.kind],
);
</script>
<template>
  <section
    class="ui-state-panel"
    :class="{ 'is-compact': compact }"
    :data-kind="kind"
    :aria-live="kind === 'loading' ? 'polite' : 'assertive'"
    :aria-busy="kind === 'loading'"
  >
    <div v-if="kind === 'loading'" class="ui-state-skeleton" aria-hidden="true">
      <i></i><i></i><i></i>
    </div>
    <span v-else class="ui-state-symbol" aria-hidden="true">{{ symbol }}</span>
    <p>{{ copy.eyebrow }}</p>
    <h2>{{ title || copy.title }}</h2>
    <div>{{ description || actionHint || copy.description }}</div>
    <dl v-if="safeRequest || safeTrace">
      <div v-if="safeRequest">
        <dt>关联编号</dt>
        <dd>{{ safeRequest }}</dd>
      </div>
      <div v-if="safeTrace">
        <dt>链路编号</dt>
        <dd>{{ safeTrace }}</dd>
      </div>
    </dl>
    <footer v-if="kind !== 'loading'">
      <button class="primary" type="button" @click="emit('primary')">
        {{ primaryLabel || copy.primary }}</button
      ><button
        v-if="secondaryLabel || copy.secondary"
        type="button"
        @click="emit('secondary')"
      >
        {{ secondaryLabel || copy.secondary }}
      </button>
    </footer>
  </section>
</template>
