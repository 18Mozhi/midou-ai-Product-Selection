<script setup lang="ts">
import { opportunityQualityGateLabels } from "./opportunity-decision-presentation";
import type { OpportunityDetail } from "./opportunity-workspace-types";

defineProps<{ qualityGates: NonNullable<OpportunityDetail["quality_gates"]> }>();
</script>

<template>
  <details class="opportunity-quality-gate-details">
    <summary>查看每项判断</summary>
    <ul class="opportunity-quality-gates" aria-label="五项质量门">
      <li
        v-for="(label, key) in opportunityQualityGateLabels"
        :key="key"
        :data-passed="qualityGates[key]"
      >
        <span>{{ label }}</span
        ><b>{{ qualityGates[key] ? "通过" : "待完成" }}</b>
      </li>
    </ul>
  </details>
</template>
