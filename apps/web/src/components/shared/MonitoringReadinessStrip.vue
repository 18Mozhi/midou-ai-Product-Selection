<script setup lang="ts">
import type { MonitoringReadinessFact, MonitoringReadinessTone } from "./monitoring-readiness";

defineProps<{
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  tone: MonitoringReadinessTone;
  facts: MonitoringReadinessFact[];
}>();
</script>

<template>
  <section class="monitoring-readiness" :data-tone="tone" :aria-label="eyebrow">
    <div class="monitoring-readiness__summary">
      <div>
        <p><i aria-hidden="true"></i>{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
        <span>{{ description }}</span>
      </div>
      <strong>{{ status }}</strong>
    </div>
    <dl>
      <div v-for="fact in facts" :key="fact.label" :data-state="fact.state">
        <dt>{{ fact.label }}</dt>
        <dd>{{ fact.value }}</dd>
        <small>{{ fact.detail }}</small>
      </div>
    </dl>
    <footer v-if="$slots.default"><slot /></footer>
  </section>
</template>

<style scoped>
.monitoring-readiness {
  min-width: 0;
  padding: 18px 20px;
  display: grid;
  gap: 16px;
  border: 1px solid var(--so-border);
  border-inline-start: 3px solid var(--so-text-muted);
  border-radius: var(--so-card-radius);
  background: var(--so-panel);
}
.monitoring-readiness[data-tone="ready"] {
  border-inline-start-color: var(--so-success);
}
.monitoring-readiness[data-tone="attention"] {
  border-inline-start-color: var(--so-warning);
}
.monitoring-readiness[data-tone="blocked"] {
  border-inline-start-color: var(--so-danger);
}
.monitoring-readiness__summary {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}
.monitoring-readiness__summary > div {
  min-width: 0;
}
.monitoring-readiness p,
.monitoring-readiness h2,
.monitoring-readiness span,
.monitoring-readiness dl {
  margin: 0;
}
.monitoring-readiness p {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--so-primary);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.monitoring-readiness p i {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 12%, transparent);
}
.monitoring-readiness h2 {
  margin-top: 6px;
  color: var(--so-text);
  font-size: clamp(20px, 2.2vw, 26px);
  line-height: 1.25;
  letter-spacing: -0.02em;
  text-wrap: balance;
}
.monitoring-readiness__summary span {
  display: block;
  max-width: 760px;
  margin-top: 6px;
  color: var(--so-text-muted);
  line-height: 1.6;
  text-wrap: pretty;
}
.monitoring-readiness__summary > strong {
  min-height: 32px;
  padding: 6px 10px;
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  border-radius: var(--so-control-radius);
  color: var(--so-text-muted);
  background: var(--so-panel-soft);
  font-size: 13px;
  font-weight: 800;
}
.monitoring-readiness[data-tone="ready"] .monitoring-readiness__summary > strong {
  color: var(--so-success);
  background: var(--so-success-soft);
}
.monitoring-readiness[data-tone="attention"] .monitoring-readiness__summary > strong {
  color: var(--so-warning);
  background: color-mix(in srgb, var(--so-warning) 10%, var(--so-panel-soft));
}
.monitoring-readiness[data-tone="blocked"] .monitoring-readiness__summary > strong {
  color: var(--so-danger);
  background: color-mix(in srgb, var(--so-danger) 9%, var(--so-panel-soft));
}
.monitoring-readiness dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.monitoring-readiness dl > div {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--so-border);
  border-radius: var(--so-control-radius);
  background: var(--so-panel-soft);
}
.monitoring-readiness dt {
  color: var(--so-text-muted);
  font-size: 13px;
}
.monitoring-readiness dd {
  margin: 4px 0 0;
  color: var(--so-text);
  font-size: 17px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.monitoring-readiness small {
  display: block;
  margin-top: 3px;
  color: var(--so-text-muted);
  font-size: 13px;
  line-height: 1.45;
}
.monitoring-readiness dl > div[data-state="ready"] dd {
  color: var(--so-success);
}
.monitoring-readiness dl > div[data-state="attention"] dd {
  color: var(--so-warning);
}
.monitoring-readiness dl > div[data-state="blocked"] dd {
  color: var(--so-danger);
}
.monitoring-readiness footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.monitoring-readiness footer :deep(a),
.monitoring-readiness footer :deep(button) {
  min-height: var(--so-touch-target);
  padding: 9px 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--so-border);
  border-radius: var(--so-control-radius);
  color: var(--so-text);
  background: var(--so-panel-soft);
  font: inherit;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}
.monitoring-readiness footer :deep(.primary) {
  border-color: var(--so-primary);
  color: var(--so-on-primary);
  background: var(--so-primary);
}
.monitoring-readiness footer :deep(button:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}
@media (max-width: 640px) {
  .monitoring-readiness {
    padding: 14px;
    gap: 12px;
  }
  .monitoring-readiness__summary {
    display: grid;
    gap: 10px;
  }
  .monitoring-readiness__summary > strong {
    justify-self: start;
  }
  .monitoring-readiness dl {
    grid-template-columns: 1fr;
  }
  .monitoring-readiness footer :deep(a),
  .monitoring-readiness footer :deep(button) {
    flex: 1 1 calc(50% - 4px);
  }
}
</style>
