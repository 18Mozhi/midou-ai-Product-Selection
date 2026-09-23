<script setup lang="ts">
import type { OnboardingStep } from "./steps";

defineProps<{ step: OnboardingStep }>();
</script>

<template>
  <section
    class="p09-panel"
    :aria-label="`第 ${step.number} 步：${step.title}`"
    aria-live="polite"
    aria-atomic="true"
  >
    <header class="p09-panel__intro">
      <p>{{ step.eyebrow }}</p>
      <h1>{{ step.title }}</h1>
      <span>{{ step.copy }}</span>
    </header>

    <div class="p09-panel__body">
      <ol class="p09-relations" aria-label="本步骤涉及的工作关系">
        <li v-for="(relation, index) in step.relations" :key="relation">
          <span class="p09-relations__index">0{{ index + 1 }}</span>
          <span>{{ relation }}</span>
        </li>
      </ol>

      <ul class="p09-points" aria-label="要点">
        <li v-for="point in step.points" :key="point">{{ point }}</li>
      </ul>

      <p class="p09-boundary">引导只改变当前页面步骤；不会创建业务数据、改变权限或保存完成状态。</p>
    </div>
  </section>
</template>
