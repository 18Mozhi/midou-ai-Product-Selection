<script setup lang="ts">
defineProps<{ notice: string; requestId: string }>();
const emit = defineEmits<{ reload: [] }>();
</script>

<template>
  <section class="org-approval-first-failure-c" aria-label="审批模板读取失败">
    <div class="org-approval-failure-symbol" aria-hidden="true">!</div>
    <p class="org-approval-failure-kicker">本次读取未完成</p>
    <h3>组织后台暂不可用</h3>
    <p class="org-approval-failure-copy">
      {{ notice || "本次读取未完成，请稍后重新加载。" }}
    </p>
    <p class="org-approval-failure-boundary">当前不展示审批内容。这不表示没有审批记录或模板。</p>
    <details v-if="requestId" class="org-approval-failure-trace">
      <summary>读取追踪</summary>
      <code>{{ requestId }}</code>
    </details>
    <button type="button" @click="emit('reload')">重新加载</button>
  </section>
</template>

<style src="../approval-read-failure.css"></style>
