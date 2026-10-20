<script setup lang="ts">
import { formatOpportunityTime } from "./opportunity-workspace-presentation";
defineProps<{ completedAt: string }>();
</script>
<template>
  <div class="opportunity-analysis-completion" role="status">
    <strong>分析已完成</strong>
    <time :datetime="completedAt">完成于 {{ formatOpportunityTime(completedAt) }}</time>
  </div>
</template>
