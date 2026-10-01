<script setup lang="ts">
defineProps<{ requestIds: string[]; traceIds: string[] }>();
</script>

<template>
  <details class="opportunity-lineage-correlation">
    <summary>全局关联标识</summary>
    <div>
      <section>
        <strong>request_id</strong>
        <code v-for="id in requestIds" :key="id">{{ id }}</code>
        <span v-if="!requestIds.length">未提供</span>
      </section>
      <section>
        <strong>trace_id</strong>
        <code v-for="id in traceIds" :key="id">{{ id }}</code>
        <span v-if="!traceIds.length">未提供</span>
      </section>
    </div>
  </details>
</template>
