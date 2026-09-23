<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef } from "vue";
import OnboardingStepPanel from "./onboarding-guide/OnboardingStepPanel.vue";
import { onboardingSteps, resolveOnboardingStep } from "./onboarding-guide/steps";
import type { OnboardingStepNumber } from "./onboarding-guide/steps";
import "./onboarding-page-c.css";

const step = shallowRef<OnboardingStepNumber>(resolveOnboardingStep(window.location.search));
const currentStep = computed(
  () => onboardingSteps.find((item) => item.number === step.value) ?? onboardingSteps[0],
);
const finishLink = useTemplateRef<HTMLAnchorElement>("finishLink");

function selectStep(nextStep: OnboardingStepNumber) {
  step.value = nextStep;
}

async function next() {
  if (step.value >= onboardingSteps.length) return;
  step.value = (step.value + 1) as OnboardingStepNumber;
  if (step.value === onboardingSteps.length) {
    await nextTick();
    finishLink.value?.focus();
  }
}

function previous() {
  if (step.value > 1) step.value = (step.value - 1) as OnboardingStepNumber;
}
</script>

<template>
  <main class="onboarding-page onboarding-page--c" data-testid="onboarding">
    <header class="p09-header">
      <RouterLink class="p09-brand" to="/" aria-label="ScoutOps 首页">
        <span aria-hidden="true">S</span>
        <span>ScoutOps <i>/</i> 快速引导</span>
      </RouterLink>
      <RouterLink class="p09-skip" to="/">跳过引导</RouterLink>
    </header>

    <OnboardingStepPanel :step="currentStep" />

    <footer class="p09-actions">
      <nav class="p09-steps" aria-label="引导步骤">
        <button
          v-for="item in onboardingSteps"
          :key="item.number"
          type="button"
          :aria-label="`前往第 ${item.number} 步`"
          :aria-current="step === item.number ? 'step' : undefined"
          @click="selectStep(item.number)"
        >
          <span aria-hidden="true">{{ item.number }}</span>
        </button>
      </nav>

      <div class="p09-actions__controls">
        <button v-if="step > 1" class="p09-secondary" type="button" @click="previous">
          上一步
        </button>
        <button
          v-if="step < onboardingSteps.length"
          class="p09-primary"
          type="button"
          @click="next"
        >
          下一步
        </button>
        <RouterLink v-else to="/" custom v-slot="{ href, navigate }">
          <a
            ref="finishLink"
            class="p09-primary"
            :href="href"
            data-testid="onboarding-finish"
            @click="navigate"
            >进入智能选品</a
          >
        </RouterLink>
      </div>
    </footer>

    <p class="p09-status">第 {{ step }} / {{ onboardingSteps.length }} 步 · 步骤只保存在当前页面</p>
  </main>
</template>
