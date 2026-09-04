<script setup lang="ts">
import { computed } from "vue";
import type { AutomaticSelectionReadiness } from "../automatic-selection-readiness";

const props = defineProps<{
  readiness: AutomaticSelectionReadiness;
}>();

const nextStep = computed(() => props.readiness.steps.find((step) => !step.ready) ?? null);
const progressLabel = computed(() =>
  props.readiness.available
    ? `已完成 ${props.readiness.readyCount} / 5 项配置`
    : "暂时无法读取五项配置状态",
);
const headline = computed(() =>
  !props.readiness.available
    ? "规则状态暂不可用"
    : props.readiness.allReady
      ? "自动推荐配置已就绪"
      : `下一步：${nextStep.value?.label ?? "检查评分规则"}`,
);
const description = computed(() =>
  !props.readiness.available
    ? "候选仍会保留；重新读取前不把未知状态当作已配置。"
    : props.readiness.allReady
      ? "系统会继续按真实证据计算，五项全部通过后才进入待你采纳。"
      : (nextStep.value?.description ?? "请检查评分规则。"),
);
</script>

<template>
  <section
    class="automatic-selection-readiness"
    :data-ready="readiness.allReady"
    aria-labelledby="automatic-selection-readiness-title"
  >
    <div class="automatic-selection-readiness__summary">
      <div class="automatic-selection-readiness__copy">
        <span>自动推荐准备度</span>
        <h3 id="automatic-selection-readiness-title">{{ headline }}</h3>
        <p>{{ description }}</p>
      </div>
      <div
        class="automatic-selection-readiness__progress"
        role="progressbar"
        aria-label="自动推荐规则配置进度"
        aria-valuemin="0"
        aria-valuemax="5"
        :aria-valuenow="readiness.available ? readiness.readyCount : undefined"
        :aria-valuetext="progressLabel"
      >
        <strong>{{ readiness.available ? `${readiness.readyCount}/5` : "—" }}</strong>
        <span>{{ readiness.available ? "配置完成" : "状态未知" }}</span>
        <i aria-hidden="true">
          <b :style="{ width: `${readiness.available ? readiness.readyCount * 20 : 0}%` }"></b>
        </i>
      </div>
      <RouterLink
        v-if="readiness.available && !readiness.allReady && nextStep"
        class="automatic-selection-readiness__next"
        :to="nextStep.route"
      >
        设置{{ nextStep.label }}
      </RouterLink>
      <RouterLink
        v-else-if="!readiness.available"
        class="automatic-selection-readiness__next"
        to="/opportunities/scoring-rules"
      >
        检查评分规则
      </RouterLink>
    </div>

    <details v-if="readiness.available" class="automatic-selection-readiness__details">
      <summary>查看五项配置状态</summary>
      <ol>
        <li v-for="step in readiness.steps" :key="step.code" :data-ready="step.ready">
          <span>
            <b>{{ step.label }}</b>
            <small>{{ step.description }}</small>
          </span>
          <em v-if="step.ready">已配置</em>
          <RouterLink v-else :to="step.route">去设置</RouterLink>
        </li>
      </ol>
    </details>
  </section>
</template>
